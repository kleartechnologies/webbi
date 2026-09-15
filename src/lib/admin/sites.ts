import "server-only";
import type { DocumentData, Query } from "firebase-admin/firestore";
import { AI_SITE_LIMIT } from "@/lib/ai/guard";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { siteFolder } from "@/lib/images/storage";
import { PAYMENT_FIELDS, SITE_ROW_FIELDS, toPaymentDto, toSiteRowDto, type AdminSiteRowDto } from "./dto";
import { queryPage } from "./paging";
import type { SiteFilter } from "./schemas";
import { emailsFor } from "./users";
import { isoTime, millis } from "./time";

/** Websites for the admin panel: list rows and one website's facts. Never its content. */

function filtered(filter: Exclude<SiteFilter, "payment_pending">): Query<DocumentData> {
  const sites = adminDb().collection("sites");
  const base =
    filter === "draft"
      ? sites.where("status", "==", "draft")
      : filter === "published"
        ? sites.where("status", "==", "published")
        : filter === "paid"
          ? sites.where("paid", "==", true)
          : filter === "suspended"
            ? sites.where("moderationStatus", "==", "suspended")
            : filter === "paid_not_live"
              ? sites.where("paid", "==", true).where("status", "==", "draft")
              : sites;
  return base.orderBy("updatedAt", "desc").select(...SITE_ROW_FIELDS);
}

export async function listSites(input: { filter: SiteFilter; limit: number; cursor?: string }): Promise<{
  sites: AdminSiteRowDto[];
  nextCursor: string | null;
}> {
  const db = adminDb();
  let rows: { id: string; data: DocumentData }[];
  let nextCursor: string | null;
  if (input.filter === "payment_pending") {
    // Websites with an open bill: paged by payment, newest bill first.
    const page = await queryPage(
      db.collection("payments").where("status", "==", "pending").orderBy("createdAt", "desc").select("siteId"),
      "payments",
      input.cursor,
      input.limit,
    );
    nextCursor = page.nextCursor;
    const siteIds = [...new Set(page.docs.map((doc) => doc.get("siteId")).filter((id): id is string => typeof id === "string" && id.length > 0))];
    const snaps = siteIds.length ? await db.getAll(...siteIds.map((id) => db.doc(`sites/${id}`)), { fieldMask: SITE_ROW_FIELDS }) : [];
    rows = snaps.filter((snap) => snap.exists).map((snap) => ({ id: snap.id, data: snap.data() ?? {} }));
  } else {
    const page = await queryPage(filtered(input.filter), "sites", input.cursor, input.limit);
    nextCursor = page.nextCursor;
    rows = page.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  }
  const emails = await emailsFor(rows.map((row) => row.data.ownerUid));
  return {
    sites: rows.map((row) => toSiteRowDto(row.id, row.data, emails.get(row.data.ownerUid) ?? null)),
    nextCursor,
  };
}

export async function siteDetail(siteId: string) {
  const db = adminDb();
  const snap = await db.getAll(db.doc(`sites/${siteId}`), { fieldMask: SITE_ROW_FIELDS });
  const site = snap[0];
  if (!site?.exists) return null;
  const data = site.data() ?? {};
  const ownerUid = typeof data.ownerUid === "string" ? data.ownerUid : null;
  const [payments, moderation, ai, emails] = await Promise.all([
    db.collection("payments").where("siteId", "==", siteId).select(...PAYMENT_FIELDS).limit(50).get(),
    db.doc(`siteModeration/${siteId}`).get(),
    db.doc(`siteAi/${siteId}`).get(),
    emailsFor([ownerUid]),
  ]);
  const ownerEmail = ownerUid ? (emails.get(ownerUid) ?? null) : null;
  const row = toSiteRowDto(site.id, data, ownerEmail);
  const note = moderation.data();
  const usage = ai.data();
  const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  return {
    site: { ...row, paidAt: isoTime(data.paidAt), paymentId: typeof data.paymentId === "string" ? data.paymentId : null },
    payments: payments.docs
      .sort((a, b) => millis(b.get("createdAt")) - millis(a.get("createdAt")))
      .map((doc) => toPaymentDto(doc.id, doc.data(), ownerEmail)),
    moderation: note
      ? {
          status: note.moderationStatus === "suspended" ? "suspended" : "active",
          reason: typeof note.moderationReason === "string" ? note.moderationReason.slice(0, 500) : null,
          suspendedAt: isoTime(note.suspendedAt),
          restoredAt: isoTime(note.restoredAt),
          updatedAt: isoTime(note.updatedAt),
        }
      : null,
    ai: { understandings: count(usage?.understandings), generations: count(usage?.generations), limits: AI_SITE_LIMIT },
    /** The public page, only while it is live and not taken down. */
    previewPath: row.status === "published" && row.slug && row.moderationStatus !== "suspended" ? `/w/${row.slug}` : null,
    /** Custom domains arrive in V2. */
    customDomain: { available: false },
  };
}

/** How many files the website keeps in Storage and their size. Loaded on demand. */
export async function siteStorage(siteId: string): Promise<{ files: number; bytes: number; capped: boolean } | null> {
  const db = adminDb();
  const [site] = await db.getAll(db.doc(`sites/${siteId}`), { fieldMask: ["ownerUid"] });
  const ownerUid = site?.exists ? site.get("ownerUid") : null;
  if (typeof ownerUid !== "string") return null;
  const MAX = 500;
  const [files] = await adminStorage().bucket().getFiles({ prefix: siteFolder(ownerUid, siteId), autoPaginate: false, maxResults: MAX });
  const bytes = files.reduce((sum, file) => sum + (Number(file.metadata.size) || 0), 0);
  return { files: files.length, bytes, capped: files.length >= MAX };
}
