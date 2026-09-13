import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { VerifiedUser } from "@/lib/auth/verify";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { quotaDay, SITE_ID } from "@/lib/site/drafts";
import { isSuspended } from "@/lib/site/moderationCore";
import { PublishError } from "@/lib/site/publish";
import type { SiteDoc, UserQuotaDoc } from "@/lib/site/types";
import { isUploadType, MAX_UPLOAD_BYTES, TOO_LARGE_MESSAGE, UNSUPPORTED_MESSAGE, UPLOAD_EXTENSIONS } from "./limits";
import { sniffImage } from "./sniff";

/**
 * Site images (Admin SDK, server only). This is the only way a file reaches
 * Firebase Storage: storage.rules refuse every write from a browser.
 *
 * An upload is checked in this order: signed-in account (not a guest), the
 * website exists, belongs to the caller and can take photos, the file is at
 * most 5 MB and its bytes are a JPEG, PNG or WebP, the account is under the
 * day's upload limit and the website under its stored-file limit. Only then
 * is the object written, at a path the server builds from the verified uid, the
 * checked site id and a random name. Nothing the browser sends (file name,
 * path, uid, Content-Type alone) decides where it lands.
 *
 * Old files are never deleted straight away: the published page, an unsaved
 * editor change or a website still being filled in may point at them. Instead,
 * each upload clears files in that website's folder that none of the owner's
 * websites reference and that are older than a day. Deleting a draft removes
 * its folder.
 */

/** Uploads an account may make per Malaysian calendar day. A full website (24 photos, cover, logo, item photos) fits in one day. */
export const DAILY_UPLOAD_LIMIT = 50;
/** Stored files per website, counted after unused ones are cleared. The largest website references about 67. */
export const SITE_FILE_LIMIT = 100;
/** Files younger than this are kept even when nothing references them yet (editor autosave, a form not submitted). */
export const UNUSED_FILE_GRACE_MS = 24 * 60 * 60 * 1000;

const UID = /^[A-Za-z0-9_-]{1,128}$/;
const CACHE_CONTROL = "public, max-age=31536000, immutable";

export type UploadErrorCode = "too_large" | "unsupported_type" | "daily_limit" | "site_full";

export class UploadError extends Error {
  constructor(
    public readonly code: UploadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

export interface StoredImage {
  url: string;
  path: string;
  width: number;
  height: number;
}

/** The only folder a website's files live in. Both parts are checked, so neither can add path segments. */
export function siteFolder(uid: string, siteId: string): string {
  if (!UID.test(uid) || !SITE_ID.test(siteId)) throw new PublishError("bad_request", "That website address isn't valid.");
  return `users/${uid}/sites/${siteId}/`;
}

/** Firebase's tokenised download URL, the same shape the browser SDK returned before. */
export function downloadUrl(bucket: string, path: string, token: string): string {
  const emulator = process.env.NODE_ENV !== "production" ? process.env.FIREBASE_STORAGE_EMULATOR_HOST : undefined;
  const origin = emulator ? `http://${emulator}` : "https://firebasestorage.googleapis.com";
  return `${origin}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

function assertUploadable(site: SiteDoc | null, uid: string): void {
  if (!site) throw new PublishError("not_found", "We couldn't find that website.");
  if (site.ownerUid !== uid) throw new PublishError("forbidden", "You can only add photos to your own website.");
  // Drafts, and live websites (the editor changes them before a republish). Never a suspended one.
  const uploadable = !isSuspended(site) && (site.status === "draft" || (site.status === "published" && site.paid === true));
  if (!uploadable) throw new PublishError("forbidden", "Photos can't be added to this website.");
}

/** Reads the request body, stopping as soon as it passes the limit. */
export async function readUpload(request: Request): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) throw new UploadError("too_large", TOO_LARGE_MESSAGE);
  if (!request.body) throw new PublishError("bad_request", "Choose a photo to upload.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_UPLOAD_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new UploadError("too_large", TOO_LARGE_MESSAGE);
    }
    chunks.push(value);
  }
  if (!total) throw new PublishError("bad_request", "Choose a photo to upload.");
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** The bytes decide the type. A declared Content-Type must agree with them, or the upload is refused. */
export function checkImage(bytes: Uint8Array, contentType: string | null) {
  const declared = (contentType ?? "").split(";")[0].trim().toLowerCase();
  const image = sniffImage(bytes);
  if (!image || !isUploadType(declared) || declared !== image.type) throw new UploadError("unsupported_type", UNSUPPORTED_MESSAGE);
  return image;
}

/** Counts the upload against the account's day, re-checking the website in the same transaction. Returns the day counted. */
async function reserveUpload(uid: string, siteId: string): Promise<string> {
  const db = adminDb();
  const quotaRef = db.doc(`userQuotas/${uid}`);
  return db.runTransaction(async (tx) => {
    const [siteSnap, quotaSnap] = await tx.getAll(db.doc(`sites/${siteId}`), quotaRef);
    assertUploadable(siteSnap.exists ? (siteSnap.data() as SiteDoc) : null, uid);
    const quota = (quotaSnap.exists ? quotaSnap.data() : {}) as Partial<UserQuotaDoc>;
    const today = quotaDay();
    const used = quota.uploadsDay === today ? (quota.uploadsToday ?? 0) : 0;
    if (used >= DAILY_UPLOAD_LIMIT) {
      throw new UploadError("daily_limit", "You've reached today's photo upload limit. Please try again tomorrow.");
    }
    // Merged: the same document carries the draft lock and AI counts.
    tx.set(quotaRef, { uploadsDay: today, uploadsToday: used + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return today;
  });
}

/** Gives back an upload that was counted but not stored. Best effort: a failure only costs the user one upload. */
async function refundUpload(uid: string, day: string): Promise<void> {
  const db = adminDb();
  const quotaRef = db.doc(`userQuotas/${uid}`);
  try {
    await db.runTransaction(async (tx) => {
      const quota = ((await tx.get(quotaRef)).data() ?? {}) as Partial<UserQuotaDoc>;
      if (quota.uploadsDay !== day || !quota.uploadsToday) return;
      tx.update(quotaRef, { uploadsToday: quota.uploadsToday - 1, updatedAt: FieldValue.serverTimestamp() });
    });
  } catch (error) {
    console.error("[images] upload refund failed", error);
  }
}

/** Everything the owner's websites point at: drafts, live copies and details not yet built. */
async function ownerReferences(uid: string): Promise<string> {
  const sites = await adminDb().collection("sites").where("ownerUid", "==", uid).get();
  return sites.docs
    .map((snap) => {
      const site = snap.data() as Partial<SiteDoc>;
      return JSON.stringify([site.draft ?? null, site.published ?? null, site.generation ?? null]);
    })
    .join("\n");
}

/** Object names are random, so finding one (as a path, or encoded inside a download URL) means it's in use. */
const referenced = (references: string, name: string) =>
  references.includes(name) || references.includes(encodeURIComponent(name));

/**
 * Deletes files in the website's folder that nothing references and that are
 * past the grace period. Returns how many files the folder still holds.
 */
export async function clearUnusedImages(uid: string, siteId: string, now = Date.now()): Promise<number> {
  const bucket = adminStorage().bucket();
  const [files] = await bucket.getFiles({ prefix: siteFolder(uid, siteId), autoPaginate: false, maxResults: 1000 });
  if (!files.length) return 0;
  const references = await ownerReferences(uid);
  const unused = files.filter((file) => {
    const created = Date.parse(String(file.metadata?.timeCreated ?? ""));
    const settled = Number.isFinite(created) && now - created >= UNUSED_FILE_GRACE_MS;
    return settled && !referenced(references, file.name);
  });
  await Promise.all(
    unused.map((file) =>
      file.delete({ ignoreNotFound: true }).catch((error: unknown) => console.error("[images] unused file not deleted", error)),
    ),
  );
  return files.length - unused.length;
}

/**
 * Removes a deleted draft's folder. Files another of the owner's websites still
 * references are kept, so a live page never loses an image.
 */
export async function deleteSiteImages(uid: string, siteId: string): Promise<void> {
  const bucket = adminStorage().bucket();
  const [files] = await bucket.getFiles({ prefix: siteFolder(uid, siteId) });
  if (!files.length) return;
  const references = await ownerReferences(uid);
  await Promise.all(
    files.filter((file) => !referenced(references, file.name)).map((file) => file.delete({ ignoreNotFound: true })),
  );
}

/** Checks and stores one image for the caller's website. See the module comment for the order of checks. */
export async function storeSiteImage(user: VerifiedUser, siteId: string, request: Request): Promise<StoredImage> {
  if (user.isAnonymous) throw new PublishError("forbidden", "Create an account to add photos.");
  const folder = siteFolder(user.uid, siteId);

  const siteSnap = await adminDb().doc(`sites/${siteId}`).get();
  assertUploadable(siteSnap.exists ? (siteSnap.data() as SiteDoc) : null, user.uid);

  const bytes = await readUpload(request);
  const image = checkImage(bytes, request.headers.get("content-type"));

  const day = await reserveUpload(user.uid, siteId);
  try {
    const stored = await clearUnusedImages(user.uid, siteId);
    if (stored >= SITE_FILE_LIMIT) {
      throw new UploadError(
        "site_full",
        "This website has reached its photo storage limit. Remove photos you no longer use, then try again tomorrow.",
      );
    }
    const bucket = adminStorage().bucket();
    const path = `${folder}img_${randomUUID().replaceAll("-", "")}.${UPLOAD_EXTENSIONS[image.type]}`;
    const token = randomUUID();
    await bucket.file(path).save(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), {
      resumable: false,
      contentType: image.type,
      metadata: { contentType: image.type, cacheControl: CACHE_CONTROL, metadata: { firebaseStorageDownloadTokens: token } },
    });
    return { url: downloadUrl(bucket.name, path, token), path, width: image.width, height: image.height };
  } catch (error) {
    await refundUpload(user.uid, day);
    throw error;
  }
}
