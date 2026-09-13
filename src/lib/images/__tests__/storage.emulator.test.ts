import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, terminate, updateDoc, type Firestore } from "firebase/firestore";
import {
  connectStorageEmulator,
  deleteObject,
  getMetadata,
  getStorage,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from "firebase/storage";
import { Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireUser, type VerifiedUser } from "@/lib/auth/verify";
import { MAX_UPLOAD_BYTES } from "@/lib/images/limits";
import { quotaDay } from "@/lib/site/drafts";
import { JPEG, oversizedJpeg, PNG, SVG } from "@/test/imageFixtures";

/**
 * Phase C against the real Storage and Firestore emulators: the deployed
 * storage.rules refuse every browser write (owner included), the upload route
 * stores through the real Admin SDK, its download URL serves the file without
 * a sign-in, and firestore.rules keep the upload count away from browsers.
 * Run with `npm run test:rules` (skipped by plain `npm test`).
 */

// Before any import reads them: the Admin SDK and the browser clients must share one project and bucket.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-webbi";
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "demo-webbi.appspot.com";
});

vi.mock("@/lib/auth/verify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/verify")>()),
  requireUser: vi.fn(),
}));

const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST;
const STORAGE = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const PROJECT = "demo-webbi";
const BUCKET = "demo-webbi.appspot.com";

describe.runIf(Boolean(FIRESTORE && STORAGE))("Phase C on the Storage and Firestore emulators", () => {
  let admin: import("firebase-admin/firestore").Firestore;
  let bucket: ReturnType<ReturnType<typeof import("@/lib/firebase/admin").adminStorage>["bucket"]>;
  let uploadRoute: (request: Request) => Promise<Response>;
  let removeRoute: (request: Request) => Promise<Response>;
  const apps: FirebaseApp[] = [];
  const firestores: Firestore[] = [];

  function app(uid: string | null, guest = false) {
    const created = initializeApp({ projectId: PROJECT, apiKey: "fake-api-key", storageBucket: BUCKET }, `${uid ?? "nobody"}-img-${apps.length}`);
    apps.push(created);
    const token = uid
      ? ({
          sub: uid,
          user_id: uid,
          ...(guest ? {} : { email: `${uid}@example.com` }),
          firebase: { sign_in_provider: guest ? "anonymous" : "password", identities: {} },
        } as never)
      : undefined;
    return { created, token };
  }

  function storageAs(uid: string | null, guest = false): FirebaseStorage {
    const { created, token } = app(uid, guest);
    const storage = getStorage(created);
    const [host, port] = String(STORAGE).split(":");
    connectStorageEmulator(storage, host, Number(port), token ? { mockUserToken: token } : {});
    return storage;
  }

  function firestoreAs(uid: string): Firestore {
    const { created, token } = app(uid);
    const db = getFirestore(created);
    const [host, port] = String(FIRESTORE).split(":");
    connectFirestoreEmulator(db, host, Number(port), { mockUserToken: token });
    firestores.push(db);
    return db;
  }

  const refused = (promise: Promise<unknown>) =>
    expect(promise).rejects.toMatchObject({ code: expect.stringMatching(/^storage\/(unauthorized|unauthenticated)$/) });

  async function post(handler: (request: Request) => Promise<Response>, user: VerifiedUser, url: string, init: RequestInit) {
    vi.mocked(requireUser).mockResolvedValue(user);
    const res = await handler(new Request(url, { method: "POST", ...init, headers: { authorization: "Bearer test-token", ...init.headers } }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  const alice: VerifiedUser = { uid: "alice", isAnonymous: false, email: "alice@example.com" };
  const bob: VerifiedUser = { uid: "bob", isAnonymous: false, email: "bob@example.com" };
  const sendImage = (user: VerifiedUser, siteId: string, bytes: Uint8Array, type: string) =>
    post(uploadRoute, user, `http://localhost/api/sites/images?siteId=${siteId}`, { headers: { "content-type": type }, body: bytes as BodyInit });

  beforeAll(async () => {
    ({ POST: uploadRoute } = await import("@/app/api/sites/images/route"));
    ({ POST: removeRoute } = await import("@/app/api/sites/delete/route"));
    const firebaseAdmin = await import("@/lib/firebase/admin");
    admin = firebaseAdmin.adminDb();
    bucket = firebaseAdmin.adminStorage().bucket();
  });

  beforeEach(async () => {
    const res = await fetch(`http://${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
    expect(res.ok).toBe(true);
    await bucket.deleteFiles({ force: true });
    const now = Timestamp.now();
    const site = { status: "draft", paid: false, slug: null, published: null, publishedAt: null, draft: null, sourceDescription: "x", generation: { status: "understood" }, language: "en", createdAt: now, updatedAt: now };
    await admin.doc("sites/alice-site").set({ ...site, ownerUid: "alice" });
    await admin.doc("sites/bob-site").set({ ...site, ownerUid: "bob" });
    await admin.doc("userQuotas/alice").set({ openDraftSiteId: "alice-site", draftsCreatedToday: 1, draftsDay: quotaDay() });
    await bucket.file("users/alice/sites/alice-site/img_existing.jpg").save(Buffer.from(JPEG), { resumable: false, contentType: "image/jpeg" });
  });

  afterAll(async () => {
    await Promise.all(firestores.map((db) => terminate(db)));
    await Promise.all(apps.map((created) => deleteApp(created)));
  });

  describe("storage.rules", () => {
    const own = "users/alice/sites/alice-site/";
    const jpeg = { contentType: "image/jpeg" };

    it("refuses the owner's own direct upload, even of a valid JPEG, PNG or WebP-sized file", async () => {
      const storage = storageAs("alice");
      await refused(uploadBytes(ref(storage, `${own}img_direct.jpg`), JPEG, jpeg));
      await refused(uploadBytes(ref(storage, `${own}img_direct.png`), PNG, { contentType: "image/png" }));
    });

    it("refuses another account, a guest and a caller with no sign-in", async () => {
      await refused(uploadBytes(ref(storageAs("bob"), `${own}img_bob.jpg`), JPEG, jpeg));
      await refused(uploadBytes(ref(storageAs("guest-1", true), "users/guest-1/sites/g/img.jpg"), JPEG, jpeg));
      await refused(uploadBytes(ref(storageAs(null), `${own}img_anon.jpg`), JPEG, jpeg));
    });

    it("refuses a file over 5 MB and a file that isn't a JPEG, PNG or WebP", async () => {
      const storage = storageAs("alice");
      await refused(uploadBytes(ref(storage, `${own}img_big.jpg`), oversizedJpeg(MAX_UPLOAD_BYTES + 1), jpeg));
      await refused(uploadBytes(ref(storage, `${own}img.svg`), SVG, { contentType: "image/svg+xml" }));
      await refused(uploadBytes(ref(storage, `${own}page.html`), SVG, { contentType: "text/html" }));
    });

    it("refuses paths outside a website folder", async () => {
      const storage = storageAs("alice");
      for (const path of ["uploads/evil.jpg", "users/alice/evil.jpg", "users/alice/sites/alice-site/nested/evil.jpg", "users/bob/sites/bob-site/evil.jpg", "evil.jpg"]) {
        await refused(uploadBytes(ref(storage, path), JPEG, jpeg));
      }
    });

    it("refuses replacing or deleting a stored file from the browser, and reading someone else's", async () => {
      const existing = `${own}img_existing.jpg`;
      await refused(uploadBytes(ref(storageAs("alice"), existing), PNG, { contentType: "image/png" }));
      await refused(deleteObject(ref(storageAs("alice"), existing)));
      await refused(deleteObject(ref(storageAs("bob"), existing)));
      await refused(getMetadata(ref(storageAs("bob"), existing)));
      await refused(getMetadata(ref(storageAs(null), existing)));
      await refused(getMetadata(ref(storageAs("alice", true), existing)));
      // The owner can still read their own file, so the rules aren't simply closed to everyone.
      await expect(getMetadata(ref(storageAs("alice"), existing))).resolves.toMatchObject({ contentType: "image/jpeg" });
      const [stillThere] = await bucket.file(existing).exists();
      expect(stillThere).toBe(true);
    });
  });

  describe("firestore.rules", () => {
    it("keeps the account's upload count out of reach of every browser, including the account's own", async () => {
      await admin.doc("userQuotas/alice").set({ uploadsDay: quotaDay(), uploadsToday: 7 }, { merge: true });
      const db = firestoreAs("alice");
      const quotaRef = doc(db, "userQuotas", "alice");
      await expect(getDoc(quotaRef)).rejects.toMatchObject({ code: "permission-denied" });
      await expect(updateDoc(quotaRef, { uploadsToday: 0 })).rejects.toMatchObject({ code: "permission-denied" });
      await expect(setDoc(quotaRef, { uploadsDay: "2000-01-01" }, { merge: true })).rejects.toMatchObject({ code: "permission-denied" });
      await expect(updateDoc(doc(db, "sites", "alice-site"), { uploadsToday: 0, updatedAt: new Date() })).rejects.toMatchObject({ code: "permission-denied" });
      expect((await admin.doc("userQuotas/alice").get()).data()).toMatchObject({ uploadsToday: 7 });
    });
  });

  describe("the upload route with the real Admin SDK", () => {
    it("stores the owner's photo, and its download URL serves it to anyone (how published pages load it)", async () => {
      const res = await sendImage(alice, "alice-site", JPEG, "image/jpeg");
      expect(res.status).toBe(201);
      const path = String(res.body.path);
      expect(path).toMatch(/^users\/alice\/sites\/alice-site\/img_[0-9a-f]{32}\.jpg$/);

      const [metadata] = await bucket.file(path).getMetadata();
      expect(metadata).toMatchObject({ contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" });

      const served = await fetch(String(res.body.url));
      expect(served.status).toBe(200);
      expect(Buffer.from(await served.arrayBuffer()).equals(Buffer.from(JPEG))).toBe(true);
      expect((await admin.doc("userQuotas/alice").get()).data()).toMatchObject({ uploadsToday: 1 });
    });

    it("stores nothing for another account's website or a disguised file", async () => {
      expect((await sendImage(bob, "alice-site", JPEG, "image/jpeg")).status).toBe(403);
      expect((await sendImage(alice, "alice-site", SVG, "image/png")).status).toBe(415);
      const [files] = await bucket.getFiles({ prefix: "users/" });
      expect(files.map((file) => file.name)).toEqual(["users/alice/sites/alice-site/img_existing.jpg"]);
    });

    it("removes a deleted draft's folder", async () => {
      await sendImage(alice, "alice-site", PNG, "image/png");
      await bucket.file("users/bob/sites/bob-site/img_keep.jpg").save(Buffer.from(JPEG), { resumable: false, contentType: "image/jpeg" });
      const res = await post(removeRoute, alice, "http://localhost/api/sites/delete", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId: "alice-site" }),
      });
      expect(res).toEqual({ status: 200, body: { deleted: true } });
      const [left] = await bucket.getFiles({ prefix: "users/" });
      expect(left.map((file) => file.name)).toEqual(["users/bob/sites/bob-site/img_keep.jpg"]);
    });
  });
});
