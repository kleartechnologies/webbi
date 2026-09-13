import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  terminate,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireUser, type VerifiedUser } from "@/lib/auth/verify";
import type { Understanding } from "@/lib/site/schema";

/**
 * Phase A against the real Firestore emulator: the deployed firestore.rules
 * for browser clients, and the real Admin SDK transaction for simultaneous
 * starts. Run with `npm run test:rules` (skipped by plain `npm test`).
 */

// Before any import reads it: the Admin SDK and the browser clients must share one emulator project.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-webbi";
});

vi.mock("@/lib/auth/verify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/verify")>()),
  requireUser: vi.fn(),
}));

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = "demo-webbi";

const UNDERSTANDING: Understanding = {
  language: "en",
  name: "Kedai Aisyah",
  category: "restaurant",
  categoryConfidence: "high",
  offerings: [],
  highlights: [],
  ctaLabel: "Order on WhatsApp",
  tone: "friendly",
  summary: "Nasi lemak in Kajang.",
};

const DRAFT_FIELDS = {
  status: "draft",
  paid: false,
  paidAt: null,
  slug: null,
  published: null,
  publishedAt: null,
  draft: null,
  sourceDescription: "Nasi lemak and kampung dishes in Kajang.",
  generation: { status: "understood" },
  language: "en",
};

describe.runIf(Boolean(HOST))("Phase A on the Firestore emulator", () => {
  let admin: import("firebase-admin/firestore").Firestore;
  let createRoute: (request: Request) => Promise<Response>;
  const apps: FirebaseApp[] = [];
  const clients: Firestore[] = [];

  /** A browser signed in as `uid` (anonymous when `guest`), talking to the emulator under the rules. */
  function browser(uid: string, guest = false): Firestore {
    const app = initializeApp({ projectId: PROJECT, apiKey: "fake-api-key" }, `${uid}-${apps.length}`);
    const db = getFirestore(app);
    const [host, port] = String(HOST).split(":");
    connectFirestoreEmulator(db, host, Number(port), {
      mockUserToken: {
        sub: uid,
        user_id: uid,
        ...(guest ? {} : { email: `${uid}@example.com` }),
        firebase: { sign_in_provider: guest ? "anonymous" : "password", identities: {} },
      } as never,
    });
    apps.push(app);
    clients.push(db);
    return db;
  }

  const denied = (promise: Promise<unknown>) => expect(promise).rejects.toMatchObject({ code: "permission-denied" });

  function start(user: VerifiedUser) {
    vi.mocked(requireUser).mockResolvedValue(user);
    return createRoute(
      new Request("http://localhost/api/sites", {
        method: "POST",
        headers: { authorization: "Bearer test-token", "content-type": "application/json" },
        body: JSON.stringify({ sourceDescription: "Nasi lemak and kampung dishes in Kajang.", understanding: UNDERSTANDING }),
      }),
    );
  }

  beforeAll(async () => {
    ({ POST: createRoute } = await import("@/app/api/sites/route"));
    admin = (await import("@/lib/firebase/admin")).adminDb();
  });

  beforeEach(async () => {
    const res = await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
      method: "DELETE",
    });
    expect(res.ok).toBe(true);
    await admin.doc("sites/alice-draft").set({
      ownerUid: "alice",
      ...DRAFT_FIELDS,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await admin.doc("userQuotas/alice").set({ openDraftSiteId: "alice-draft", draftsCreatedToday: 1, draftsDay: "2026-09-13" });
  });

  afterAll(async () => {
    await Promise.all(clients.map((db) => terminate(db)));
    await Promise.all(apps.map((app) => deleteApp(app)));
  });

  describe("firestore.rules", () => {
    it("refuses a site created from the browser, even a perfectly shaped one", async () => {
      const alice = browser("alice");
      const valid = { ownerUid: "alice", ...DRAFT_FIELDS, createdAt: new Date(), updatedAt: new Date() };
      await denied(addDoc(collection(alice, "sites"), valid));
      await denied(setDoc(doc(alice, "sites", "handmade"), valid));

      // The old guest handoff path: a guest (or the account it signed in to) writing a copy.
      const guest = browser("guest-1", true);
      await denied(addDoc(collection(guest, "sites"), { ...valid, ownerUid: "guest-1" }));
      await denied(addDoc(collection(alice, "sites"), { ...valid, sourceDescription: "copied from guest" }));

      expect((await admin.collection("sites").get()).docs.map((snap) => snap.id)).toEqual(["alice-draft"]);
    });

    it("still lets the owner read and edit their draft, and nothing more", async () => {
      const alice = browser("alice");
      expect((await getDoc(doc(alice, "sites", "alice-draft"))).data()?.ownerUid).toBe("alice");
      await expect(
        updateDoc(doc(alice, "sites", "alice-draft"), { sourceDescription: "Updated description", updatedAt: new Date() }),
      ).resolves.toBeUndefined();

      await denied(updateDoc(doc(alice, "sites", "alice-draft"), { status: "published" }));
      await denied(updateDoc(doc(alice, "sites", "alice-draft"), { ownerUid: "bob" }));
      await denied(deleteDoc(doc(alice, "sites", "alice-draft")));
      await denied(getDoc(doc(browser("bob"), "sites", "alice-draft")));
      expect((await admin.doc("sites/alice-draft").get()).exists).toBe(true);
    });

    it("keeps userQuotas out of reach of every browser, including the account's own", async () => {
      const alice = browser("alice");
      const ref = doc(alice, "userQuotas", "alice");
      await denied(getDoc(ref));
      await denied(setDoc(ref, { openDraftSiteId: null, draftsCreatedToday: 0, draftsDay: "2026-09-13" }));
      await denied(updateDoc(ref, { openDraftSiteId: null }));
      await denied(deleteDoc(ref));
      await denied(setDoc(doc(browser("bob"), "userQuotas", "bob"), { draftsCreatedToday: 0 }));

      expect((await admin.doc("userQuotas/alice").get()).data()).toMatchObject({ openDraftSiteId: "alice-draft", draftsCreatedToday: 1 });
    });
  });

  describe("POST /api/sites with real transactions", () => {
    it("lets exactly one of ten simultaneous starts through", async () => {
      const user: VerifiedUser = { uid: "racer", isAnonymous: false, email: "racer@example.com" };
      const responses = await Promise.all(Array.from({ length: 10 }, () => start(user)));
      const statuses = responses.map((res) => res.status);

      expect(statuses.filter((status) => status === 201)).toHaveLength(1);
      expect(statuses.filter((status) => status === 409)).toHaveLength(9);
      const { siteId } = (await responses[statuses.indexOf(201)].json()) as { siteId: string };
      const sites = await admin.collection("sites").where("ownerUid", "==", "racer").get();
      expect(sites.docs.map((snap) => snap.id)).toEqual([siteId]);
      expect((await admin.doc("userQuotas/racer").get()).data()).toMatchObject({ openDraftSiteId: siteId, draftsCreatedToday: 1 });
    });

    it("blocks a legacy account with several drafts without touching them", async () => {
      const older = Timestamp.fromDate(new Date("2026-01-01T00:00:00Z"));
      const newer = Timestamp.fromDate(new Date("2026-02-01T00:00:00Z"));
      await admin.doc("sites/legacy-b").set({ ownerUid: "legacy", ...DRAFT_FIELDS, createdAt: newer, updatedAt: newer });
      await admin.doc("sites/legacy-a").set({ ownerUid: "legacy", ...DRAFT_FIELDS, createdAt: older, updatedAt: older });

      const res = await start({ uid: "legacy", isAnonymous: false });
      expect(res.status).toBe(409);
      expect(((await res.json()) as { error: { existingSiteId: string } }).error.existingSiteId).toBe("legacy-a");
      const sites = await admin.collection("sites").where("ownerUid", "==", "legacy").get();
      expect(sites.docs.map((snap) => snap.id).sort()).toEqual(["legacy-a", "legacy-b"]);
      expect((await admin.doc("userQuotas/legacy").get()).data()?.openDraftSiteId).toBe("legacy-a");
    });
  });
});
