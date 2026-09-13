import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { Timestamp } from "firebase-admin/firestore";
import { matchRemotePattern } from "next/dist/shared/lib/match-remote-pattern";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as removeRoute } from "@/app/api/sites/delete/route";
import { POST as uploadRoute } from "@/app/api/sites/images/route";
import { requireUser, UnauthorizedError, type VerifiedUser } from "@/lib/auth/verify";
import { MAX_UPLOAD_BYTES } from "@/lib/images/limits";
import { MAX_IMAGE_EDGE, sniffImage } from "@/lib/images/sniff";
import { DAILY_UPLOAD_LIMIT, SITE_FILE_LIMIT, UNUSED_FILE_GRACE_MS } from "@/lib/images/storage";
import { quotaDay } from "@/lib/site/drafts";
import { FakeFirestore } from "@/test/fakeFirestore";
import { HTML, JPEG, oversizedJpeg, PNG, randomBytes, SVG, WEBP, WEBP_LOSSLESS, webpExtended } from "@/test/imageFixtures";
import nextConfig from "../../../../next.config";

/**
 * Phase C: photo uploads through Webbi's real route handlers and storage code,
 * with Firestore faked in memory and the Storage bucket faked at the Admin SDK.
 * storage.rules and firestore.rules run against the emulators in
 * storage.emulator.test.ts (npm run test:rules).
 */

const state = vi.hoisted(() => ({ db: undefined as unknown, bucket: undefined as unknown }));

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: () => state.db,
  adminStorage: () => ({ bucket: () => state.bucket }),
  AdminNotConfiguredError: class AdminNotConfiguredError extends Error {},
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/auth/verify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/verify")>()),
  requireUser: vi.fn(),
}));

const BUCKET = "test.appspot.com"; // NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in vitest.config.ts
const STORED_PATH = /^users\/alice\/sites\/alice-site\/img_[0-9a-f]{32}\.(jpg|png|webp)$/;
const DAY = 24 * 60 * 60 * 1000;

interface StoredObject {
  bytes: Buffer;
  contentType?: string;
  cacheControl?: string;
  token?: string;
  timeCreated: string;
}

type SaveOptions = {
  contentType?: string;
  metadata?: { contentType?: string; cacheControl?: string; metadata?: { firebaseStorageDownloadTokens?: string } };
};

/** The part of @google-cloud/storage's Bucket that Webbi uses. */
class FakeBucket {
  readonly name = BUCKET;
  readonly objects = new Map<string, StoredObject>();
  failSave = false;
  failList = false;

  file(name: string) {
    const objects = this.objects;
    const fail = () => this.failSave;
    return {
      name,
      get metadata() {
        return { timeCreated: objects.get(name)?.timeCreated };
      },
      async save(data: Buffer, options: SaveOptions) {
        if (fail()) throw new Error(`GaxiosError: bucket ${BUCKET} denied service account webbi@x.iam at /v1/b/${BUCKET}`);
        objects.set(name, {
          bytes: Buffer.from(data),
          contentType: options.metadata?.contentType,
          cacheControl: options.metadata?.cacheControl,
          token: options.metadata?.metadata?.firebaseStorageDownloadTokens,
          timeCreated: new Date().toISOString(),
        });
      },
      async delete() {
        objects.delete(name);
      },
    };
  }

  async getFiles({ prefix }: { prefix: string }) {
    if (this.failList) throw new Error(`storage.objects.list denied on ${BUCKET}`);
    return [[...this.objects.keys()].filter((name) => name.startsWith(prefix)).map((name) => this.file(name))];
  }

  /** An object uploaded before now, e.g. before this change. */
  put(name: string, ageMs = 0) {
    this.objects.set(name, { bytes: Buffer.from(JPEG), contentType: "image/jpeg", timeCreated: new Date(Date.now() - ageMs).toISOString() });
  }

  names(prefix = "") {
    return [...this.objects.keys()].filter((name) => name.startsWith(prefix)).sort();
  }
}

type Doc = Record<string, unknown>;

let db: FakeFirestore;
let bucket: FakeBucket;

const alice: VerifiedUser = { uid: "alice", isAnonymous: false, email: "alice@example.com" };
const guest: VerifiedUser = { uid: "guest-1", isAnonymous: true };

const quota = (uid: string): Doc | undefined => db.read(`userQuotas/${uid}`);
const urlFor = (path: string) => `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=legacy-token`;
const imageAt = (path: string) => ({ url: urlFor(path), path, width: 800, height: 600 });

function seedSite(id: string, ownerUid: string, extra: Doc = {}) {
  db.seed(`sites/${id}`, {
    ownerUid,
    status: "draft",
    paid: false,
    paidAt: null,
    slug: null,
    published: null,
    publishedAt: null,
    draft: null,
    sourceDescription: "Nasi lemak in Kajang.",
    generation: { status: "understood" },
    language: "en",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...extra,
  });
}

/** Just enough site content to point at images the way the editor saves them. */
const contentWith = (...images: ReturnType<typeof imageAt>[]) => ({
  business: { name: "Kedai Aisyah", heroImage: images[0] },
  sections: [{ type: "gallery", images: images.slice(1) }],
});

interface Sent {
  status: number;
  text: string;
  body: Doc & { error?: { code: string; message: string; reason?: string } };
}

async function upload(
  user: VerifiedUser | null,
  siteId: string,
  body: Uint8Array | null,
  type: string | null = "image/jpeg",
  { query = "", headers = {} }: { query?: string; headers?: Record<string, string> } = {},
): Promise<Sent> {
  if (user) vi.mocked(requireUser).mockResolvedValue(user);
  else vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());
  const res = await uploadRoute(
    new Request(`http://localhost/api/sites/images?siteId=${encodeURIComponent(siteId)}${query}`, {
      method: "POST",
      headers: { authorization: "Bearer test-token", ...(type ? { "content-type": type } : {}), ...headers },
      body: body as BodyInit | null,
    }),
  );
  const text = await res.text();
  return { status: res.status, text, body: text ? JSON.parse(text) : {} };
}

async function removeDraft(user: VerifiedUser, siteId: string): Promise<Sent> {
  vi.mocked(requireUser).mockResolvedValue(user);
  const res = await removeRoute(
    new Request("http://localhost/api/sites/delete", {
      method: "POST",
      headers: { authorization: "Bearer test-token", "content-type": "application/json" },
      body: JSON.stringify({ siteId }),
    }),
  );
  const text = await res.text();
  return { status: res.status, text, body: JSON.parse(text) };
}

beforeEach(() => {
  db = new FakeFirestore();
  bucket = new FakeBucket();
  state.db = db;
  state.bucket = bucket;
  seedSite("alice-site", "alice");
  seedSite("bob-site", "bob");
  vi.mocked(requireUser).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reading an image's real type from its bytes", () => {
  it("recognises JPEG, PNG and every WebP flavour, with their dimensions", () => {
    expect(sniffImage(JPEG)).toEqual({ type: "image/jpeg", width: 3, height: 2 });
    expect(sniffImage(PNG)).toEqual({ type: "image/png", width: 3, height: 2 });
    expect(sniffImage(WEBP)).toEqual({ type: "image/webp", width: 1, height: 1 });
    expect(sniffImage(WEBP_LOSSLESS)).toEqual({ type: "image/webp", width: 1, height: 1 });
    expect(sniffImage(webpExtended(640, 480))).toEqual({ type: "image/webp", width: 640, height: 480 });
  });

  it("finds nothing in SVG, HTML, random bytes, truncated headers or absurd dimensions", () => {
    expect(sniffImage(SVG)).toBeNull();
    expect(sniffImage(HTML)).toBeNull();
    expect(sniffImage(randomBytes())).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
    expect(sniffImage(JPEG.subarray(0, 40))).toBeNull();
    expect(sniffImage(PNG.subarray(0, 20))).toBeNull();
    expect(sniffImage(WEBP.subarray(0, 20))).toBeNull();
    // A signature alone is not enough.
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
    expect(sniffImage(Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBP"), Buffer.from(SVG)]))).toBeNull();
    const huge = Buffer.from(PNG);
    huge.writeUInt32BE(MAX_IMAGE_EDGE + 1, 16);
    expect(sniffImage(huge)).toBeNull();
    expect(sniffImage(webpExtended(1, 1))).not.toBeNull();
  });
});

describe("POST /api/sites/images", () => {
  describe("the owner uploads a photo", () => {
    it.each([
      ["JPEG", JPEG, "image/jpeg", "jpg", 3, 2],
      ["PNG", PNG, "image/png", "png", 3, 2],
      ["WebP", WEBP, "image/webp", "webp", 1, 1],
      ["lossless WebP", WEBP_LOSSLESS, "image/webp", "webp", 1, 1],
    ])("stores a %s in the website's folder under a name the server picks", async (_, bytes, type, ext, width, height) => {
      const res = await upload(alice, "alice-site", bytes, type);
      expect(res.status).toBe(201);
      const { url, path } = res.body as { url: string; path: string };
      expect(path).toMatch(STORED_PATH);
      expect(path.endsWith(`.${ext}`)).toBe(true);
      expect(res.body).toMatchObject({ width, height });

      const stored = bucket.objects.get(path);
      expect(stored?.bytes.equals(Buffer.from(bytes))).toBe(true);
      expect(stored).toMatchObject({ contentType: type, cacheControl: "public, max-age=31536000, immutable" });
      // The same tokenised download URL the browser SDK used to return.
      expect(stored?.token).toMatch(/^[0-9a-f-]{36}$/);
      expect(url).toBe(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${stored?.token}`);
      expect(quota("alice")).toMatchObject({ uploadsDay: quotaDay(), uploadsToday: 1 });
    });

    it("also works on the owner's live website, which the editor changes before a republish", async () => {
      seedSite("alice-live", "alice", { status: "published", paid: true, slug: "kedai-aisyah" });
      const res = await upload(alice, "alice-live", JPEG);
      expect(res.status).toBe(201);
      expect(String(res.body.path)).toMatch(/^users\/alice\/sites\/alice-live\/img_[0-9a-f]{32}\.jpg$/);
    });
  });

  describe("who may upload", () => {
    it("refuses a caller without a valid sign-in (401)", async () => {
      const res = await upload(null, "alice-site", JPEG);
      expect(res.status).toBe(401);
      expect(res.body.error?.code).toBe("unauthenticated");
      expect(bucket.names()).toEqual([]);
      expect(quota("alice")).toBeUndefined();
    });

    it("refuses a guest session (403)", async () => {
      seedSite("guest-site", "guest-1");
      const res = await upload(guest, "guest-site", JPEG);
      expect(res.status).toBe(403);
      expect(bucket.names()).toEqual([]);
      expect(quota("guest-1")).toBeUndefined();
    });

    it("refuses another account's website (403) and a website that doesn't exist (404)", async () => {
      const theirs = await upload(alice, "bob-site", JPEG);
      expect(theirs.status).toBe(403);
      expect(theirs.body.error?.code).toBe("forbidden");
      const missing = await upload(alice, "no-such-site", JPEG);
      expect(missing.status).toBe(404);
      expect(bucket.names()).toEqual([]);
      expect(quota("alice")).toBeUndefined();
    });

    it("refuses a published website that was never paid for", async () => {
      seedSite("odd-site", "alice", { status: "published", paid: false });
      expect((await upload(alice, "odd-site", JPEG)).status).toBe(403);
    });
  });

  describe("where the file goes", () => {
    it("ignores any path, folder or file name the browser suggests", async () => {
      const res = await upload(alice, "alice-site", JPEG, "image/jpeg", {
        query: "&path=users/bob/sites/bob-site/evil.jpg&name=../../../evil.jpg&folder=uploads",
        headers: { "x-goog-object-name": "users/bob/sites/bob-site/evil.jpg", "x-upload-path": "/" },
      });
      expect(res.status).toBe(201);
      expect(bucket.names()).toEqual([res.body.path]);
      expect(String(res.body.path)).toMatch(STORED_PATH);
      expect(bucket.names("users/bob/")).toEqual([]);
    });

    it("never takes the owner's uid from the request", async () => {
      const res = await upload(alice, "alice-site", JPEG, "image/jpeg", {
        query: "&uid=bob&ownerUid=bob",
        headers: { "x-owner-uid": "bob" },
      });
      expect(res.status).toBe(201);
      expect(String(res.body.path).startsWith("users/alice/sites/alice-site/")).toBe(true);
      expect(quota("bob")).toBeUndefined();
    });

    it.each(["../bob-site", "alice-site/../../bob", "alice-site/", "..", ".", "", "a".repeat(65), "alice site", "alice-site\\x"])(
      "refuses the site id %j before touching anything (400)",
      async (siteId) => {
        const res = await upload(alice, siteId, JPEG);
        expect(res.status).toBe(400);
        expect(bucket.names()).toEqual([]);
        expect(quota("alice")).toBeUndefined();
      },
    );

    it("treats a hostile file name as nothing: not in the path, not echoed back", async () => {
      const name = `../../<img src=x onerror=alert(1)>"'\\é😀${"a".repeat(5000)}.png`;
      const res = await upload(alice, "alice-site", PNG, "image/png", {
        query: `&filename=${encodeURIComponent(name)}`,
        headers: { "content-disposition": `attachment; filename="${encodeURIComponent(name)}"`, "x-file-name": encodeURIComponent(name) },
      });
      expect(res.status).toBe(201);
      expect(String(res.body.path)).toMatch(STORED_PATH);
      for (const fragment of ["onerror", "..", "%2E%2E", "😀", "aaaaaaaa", "<img"]) expect(res.text).not.toContain(fragment);
    });
  });

  describe("size and type", () => {
    it("accepts exactly 5 MB and refuses one byte more (413), whether or not the size is declared", async () => {
      expect((await upload(alice, "alice-site", oversizedJpeg(MAX_UPLOAD_BYTES))).status).toBe(201);

      const streamed = await upload(alice, "alice-site", oversizedJpeg(MAX_UPLOAD_BYTES + 1));
      expect(streamed.status).toBe(413);
      expect(streamed.body.error).toEqual({ code: "payload_too_large", message: "That image is over 5 MB. Choose a smaller one." });

      const declared = await upload(alice, "alice-site", JPEG, "image/jpeg", { headers: { "content-length": String(MAX_UPLOAD_BYTES + 1) } });
      expect(declared.status).toBe(413);

      expect(bucket.names()).toHaveLength(1);
      expect(quota("alice")).toMatchObject({ uploadsToday: 1 });
    });

    it.each([
      ["a real SVG", SVG, "image/svg+xml"],
      ["an SVG claiming to be a PNG", SVG, "image/png"],
      ["HTML claiming to be a JPEG", HTML, "image/jpeg"],
      ["random bytes claiming to be a WebP", randomBytes(), "image/webp"],
      ["random bytes claiming to be a JPEG", randomBytes(), "image/jpeg"],
      ["a PNG claiming to be a JPEG", PNG, "image/jpeg"],
      ["a JPEG with no type at all", JPEG, null],
      ["a JPEG sent as a download", JPEG, "application/octet-stream"],
    ])("refuses %s (415) without storing or counting it", async (_, bytes, type) => {
      const res = await upload(alice, "alice-site", bytes, type);
      expect(res.status).toBe(415);
      expect(res.body.error).toEqual({ code: "unsupported_media_type", message: "Please choose a JPG, PNG or WebP photo." });
      expect(bucket.names()).toEqual([]);
      expect(quota("alice")).toBeUndefined();
    });

    it("refuses an empty body (400)", async () => {
      expect((await upload(alice, "alice-site", new Uint8Array(), "image/jpeg")).status).toBe(400);
      expect(bucket.names()).toEqual([]);
    });
  });

  describe("limits", () => {
    it(`allows ${DAILY_UPLOAD_LIMIT} uploads a Malaysian day per account, then refuses (429) until the next day`, async () => {
      db.seed("userQuotas/alice", { uploadsDay: quotaDay(), uploadsToday: DAILY_UPLOAD_LIMIT - 1 });
      expect((await upload(alice, "alice-site", JPEG)).status).toBe(201);
      const refused = await upload(alice, "alice-site", JPEG);
      expect(refused.status).toBe(429);
      expect(refused.body.error).toMatchObject({ code: "rate_limited", reason: "daily_limit" });
      expect(bucket.names()).toHaveLength(1);
      expect(quota("alice")).toMatchObject({ uploadsToday: DAILY_UPLOAD_LIMIT });

      // Yesterday's count doesn't carry over; the other counters on the document are left alone.
      db.seed("userQuotas/alice", { uploadsDay: "2000-01-01", uploadsToday: DAILY_UPLOAD_LIMIT, aiRequestsToday: 4, openDraftSiteId: "alice-site" });
      expect((await upload(alice, "alice-site", JPEG)).status).toBe(201);
      expect(quota("alice")).toMatchObject({ uploadsDay: quotaDay(), uploadsToday: 1, aiRequestsToday: 4, openDraftSiteId: "alice-site" });
    });

    it("doesn't count refused or failed uploads", async () => {
      db.seed("userQuotas/alice", { uploadsDay: quotaDay(), uploadsToday: DAILY_UPLOAD_LIMIT - 1 });
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      await upload(alice, "alice-site", SVG, "image/png"); // 415
      await upload(alice, "alice-site", oversizedJpeg(MAX_UPLOAD_BYTES + 1)); // 413
      await upload(alice, "bob-site", JPEG); // 403
      await upload(null, "alice-site", JPEG); // 401
      bucket.failSave = true;
      expect((await upload(alice, "alice-site", JPEG)).status).toBe(500);
      bucket.failSave = false;
      expect(quota("alice")).toMatchObject({ uploadsToday: DAILY_UPLOAD_LIMIT - 1 });
      expect((await upload(alice, "alice-site", JPEG)).status).toBe(201);
    });

    it("doesn't give back an upload when a photo is removed", async () => {
      const first = await upload(alice, "alice-site", JPEG);
      db.patch("sites/alice-site", { draft: contentWith(imageAt(String(first.body.path))) });
      db.patch("sites/alice-site", { draft: contentWith() });
      expect((await upload(alice, "alice-site", JPEG)).status).toBe(201);
      expect(quota("alice")).toMatchObject({ uploadsToday: 2 });
    });

    it(`caps a website at ${SITE_FILE_LIMIT} stored files and gives the upload back (429)`, async () => {
      for (let i = 0; i < SITE_FILE_LIMIT; i += 1) bucket.put(`users/alice/sites/alice-site/img_${String(i).padStart(32, "0")}.jpg`);
      const res = await upload(alice, "alice-site", JPEG);
      expect(res.status).toBe(429);
      expect(res.body.error).toMatchObject({ code: "rate_limited", reason: "site_full" });
      expect(bucket.names()).toHaveLength(SITE_FILE_LIMIT);
      expect(quota("alice")).toMatchObject({ uploadsToday: 0 });
      // Another website of the same owner has its own room.
      seedSite("alice-live", "alice", { status: "published", paid: true });
      expect((await upload(alice, "alice-live", JPEG)).status).toBe(201);
    });

    it("answers a storage failure with a plain 500 that reveals nothing about the bucket or the error", async () => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
      bucket.failSave = true;
      const res = await upload(alice, "alice-site", JPEG);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: { code: "internal", message: "Something went wrong on our side. Please try again." } });
      for (const leak of [BUCKET, "appspot", "Gaxios", "service account", "iam", "/v1/b", "at ", "FIREBASE", "process.env"]) {
        expect(res.text).not.toContain(leak);
      }
      expect(logged).toHaveBeenCalled();
    });
  });
});

describe("clearing files a website no longer uses", () => {
  const folder = "users/alice/sites/alice-site/";

  it("removes a replaced photo once nothing references it and it's past the grace period", async () => {
    const a = await upload(alice, "alice-site", JPEG);
    const pathA = String(a.body.path);
    db.patch("sites/alice-site", { draft: contentWith(imageAt(pathA)) });

    // Replace A with B: B uploads first, then the saved draft points at B.
    const b = await upload(alice, "alice-site", JPEG);
    const pathB = String(b.body.path);
    db.patch("sites/alice-site", { draft: contentWith(imageAt(pathB)) });
    expect(bucket.names(folder)).toEqual([pathA, pathB].sort()); // A isn't deleted straight away

    // A day later, the next upload clears A. B (in use) and C (brand new) stay.
    bucket.objects.get(pathA)!.timeCreated = new Date(Date.now() - UNUSED_FILE_GRACE_MS - 1000).toISOString();
    bucket.objects.get(pathB)!.timeCreated = new Date(Date.now() - 3 * DAY).toISOString();
    const c = await upload(alice, "alice-site", JPEG);
    expect(bucket.names(folder)).toEqual([pathB, String(c.body.path)].sort());
  });

  it("keeps a recent unreferenced upload: the editor may not have saved it yet", async () => {
    bucket.put(`${folder}img_recent.webp`, UNUSED_FILE_GRACE_MS - 60_000);
    await upload(alice, "alice-site", JPEG);
    expect(bucket.names(folder)).toContain(`${folder}img_recent.webp`);
  });

  it("keeps images the live page shows, including files from before this change", async () => {
    const live = `${folder}img_published.webp`;
    const legacy = `${folder}img_legacy_url_only.jpg`;
    const inputOnly = `${folder}img_details_step.jpg`;
    const orphan = `${folder}img_orphan.jpg`;
    for (const name of [live, legacy, inputOnly, orphan]) bucket.put(name, 90 * DAY);
    seedSite("alice-site", "alice", {
      status: "published",
      paid: true,
      slug: "kedai-aisyah",
      draft: contentWith(), // photos removed in the editor, not republished yet
      published: contentWith(imageAt(live), { ...imageAt(legacy), path: undefined } as never),
      generation: { status: "ready", input: { photos: [imageAt(inputOnly)] } },
    });

    expect((await upload(alice, "alice-site", JPEG)).status).toBe(201);
    const left = bucket.names(folder);
    expect(left).toEqual(expect.arrayContaining([live, legacy, inputOnly]));
    expect(left).not.toContain(orphan);
  });

  it("keeps a file another of the owner's websites points at, and never looks outside the website's folder", async () => {
    const shared = `${folder}img_shared.jpg`;
    const elsewhere = "users/alice/sites/alice-live/img_old.jpg";
    const bobs = "users/bob/sites/bob-site/img_old.jpg";
    for (const name of [shared, elsewhere, bobs]) bucket.put(name, 90 * DAY);
    seedSite("alice-live", "alice", { status: "published", paid: true, published: contentWith(imageAt(shared)) });

    await upload(alice, "alice-site", JPEG);
    expect(bucket.names()).toEqual(expect.arrayContaining([shared, elsewhere, bobs]));
  });
});

describe("deleting a draft removes its photos", () => {
  const folder = "users/alice/sites/alice-site/";

  beforeEach(() => {
    db.seed("userQuotas/alice", { openDraftSiteId: "alice-site", draftsCreatedToday: 1, draftsDay: quotaDay() });
  });

  it("deletes every file in the draft's folder and nothing else", async () => {
    const own = [`${folder}img_a.webp`, `${folder}img_b.jpg`, `${folder}img_new.png`];
    own.forEach((name, i) => bucket.put(name, i * DAY));
    const shared = `${folder}img_on_live_page.jpg`;
    bucket.put(shared, 30 * DAY);
    const others = ["users/alice/sites/alice-live/img_live.jpg", "users/bob/sites/bob-site/img_x.jpg", "users/alice/sites/alice-site-2/img_y.jpg"];
    others.forEach((name) => bucket.put(name, 30 * DAY));
    seedSite("alice-live", "alice", { status: "published", paid: true, published: contentWith(imageAt(others[0]), imageAt(shared)) });

    const res = await removeDraft(alice, "alice-site");
    expect(res).toMatchObject({ status: 200, body: { deleted: true } });
    expect(db.read("sites/alice-site")).toBeUndefined();
    expect(bucket.names(folder)).toEqual([shared]);
    expect(bucket.names()).toEqual([...others, shared].sort());
  });

  it("still deletes the draft when its files can't be removed, and says nothing about why", async () => {
    bucket.put(`${folder}img_a.webp`, DAY);
    bucket.failList = true;
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await removeDraft(alice, "alice-site");
    expect(res).toMatchObject({ status: 200, body: { deleted: true } });
    expect(res.text).not.toContain(BUCKET);
    expect(db.read("sites/alice-site")).toBeUndefined();
    expect(logged).toHaveBeenCalled();
  });

  it("touches no files when the delete itself is refused", async () => {
    bucket.put(`${folder}img_a.webp`, DAY);
    bucket.put("users/bob/sites/bob-site/img_b.webp", DAY);
    seedSite("alice-paid", "alice", { status: "published", paid: true });
    bucket.put("users/alice/sites/alice-paid/img_c.webp", DAY);

    expect((await removeDraft(alice, "bob-site")).status).toBe(404);
    expect((await removeDraft(alice, "alice-paid")).status).toBe(409);
    expect(bucket.names()).toHaveLength(3);
  });
});

describe("no way around the upload route", () => {
  const ROOT = process.cwd();
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  const app = walk(join(ROOT, "src")).filter((file) => /\.(ts|tsx)$/.test(file) && !/__tests__|\/test\//.test(file));

  it("has no browser code that writes to or deletes from Storage", () => {
    const writers = app.filter((file) => /\b(uploadBytes|uploadBytesResumable|uploadString|deleteObject)\b/.test(readFileSync(file, "utf8")));
    expect(writers.map((file) => relative(ROOT, file))).toEqual([]);
  });

  it("has exactly one server module that writes objects: the checked upload path", () => {
    const savers = app.filter((file) => /\.file\([^)]*\)\s*\.save\(|adminStorage\(\)/.test(readFileSync(file, "utf8")));
    expect(savers.map((file) => relative(ROOT, file)).sort()).toEqual(["src/lib/firebase/admin.ts", "src/lib/images/storage.ts"]);
  });

  it("ships storage rules that refuse every browser write and only let an owner read", () => {
    const rules = readFileSync(join(ROOT, "storage.rules"), "utf8").replace(/\/\/[^\n]*/g, "");
    const allows = [...rules.matchAll(/allow\s+([a-z, ]+):\s*if\s+([^;]+);/g)].map(([, ops, condition]) => ({ ops: ops.trim(), condition: condition.replace(/\s+/g, " ").trim() }));
    expect(allows).toEqual([
      { ops: "read", condition: "request.auth != null && request.auth.uid == uid && request.auth.token.firebase.sign_in_provider != 'anonymous'" },
      { ops: "write", condition: "false" },
      { ops: "read, write", condition: "false" },
    ]);
  });

  it("keeps the upload counts out of every browser's reach in firestore.rules", () => {
    const rules = readFileSync(join(ROOT, "firestore.rules"), "utf8");
    expect(rules).toMatch(/match \/userQuotas\/\{uid\} \{\s*allow read, write: if false;\s*\}/);
  });
});

describe("the image optimiser's allowed sources (next.config.ts)", () => {
  const patterns = nextConfig.images?.remotePatterns ?? [];
  const allowed = (url: string) => patterns.some((pattern) => matchRemotePattern(pattern as never, new URL(url)));

  it("accepts Webbi's own download URLs, old and new", () => {
    expect(allowed(urlFor("users/alice/sites/alice-site/img_0123456789.webp"))).toBe(true);
    expect(allowed(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/users%2Fu1%2Fsites%2Fs1%2Fa.webp?alt=media&token=t`)).toBe(true);
  });

  it.each([
    "https://evil.example/cat.jpg",
    "https://firebasestorage.googleapis.com.evil.example/v0/b/test.appspot.com/o/x",
    "http://firebasestorage.googleapis.com/v0/b/test.appspot.com/o/x?alt=media",
    "https://firebasestorage.googleapis.com/v0/b/someone-else.appspot.com/o/x?alt=media",
    "https://storage.googleapis.com/test.appspot.com/x.jpg",
    "https://attacker.firebasestorage.app/x.jpg",
    "https://lh3.googleusercontent.com/a/photo",
    "https://169.254.169.254/latest/meta-data",
    "http://localhost:3000/api/sites",
  ])("refuses %s", (url) => {
    expect(allowed(url)).toBe(false);
  });
});
