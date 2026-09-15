import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import {
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
import { getAiProvider } from "@/lib/ai";
import { requireUser, type VerifiedUser } from "@/lib/auth/verify";
import { quotaDay } from "@/lib/site/drafts";
import { AI_SITE, AI_UNDERSTANDING, draftFields, gate } from "./guardFixtures";

/**
 * Phase B against the real Firestore emulator: the deployed firestore.rules keep
 * every browser away from AI counts and locks, and the real Admin SDK
 * transaction lets one of several simultaneous builds through. Run with
 * `npm run test:rules` (skipped by plain `npm test`). No provider is called.
 */

// Before any import reads it: the Admin SDK and the browser clients must share one emulator project.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-webbi";
});

vi.mock("@/lib/auth/verify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/verify")>()),
  requireUser: vi.fn(),
}));
vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  getAiProvider: vi.fn(),
}));

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = "demo-webbi";

describe.runIf(Boolean(HOST))("Phase B on the Firestore emulator", () => {
  let admin: import("firebase-admin/firestore").Firestore;
  let generateRoute: (request: Request) => Promise<Response>;
  const apps: FirebaseApp[] = [];
  const clients: Firestore[] = [];

  function browser(uid: string, guest = false): Firestore {
    const app = initializeApp({ projectId: PROJECT, apiKey: "fake-api-key" }, `${uid}-ai-${apps.length}`);
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

  function build(user: VerifiedUser, siteId: string) {
    vi.mocked(requireUser).mockResolvedValue(user);
    return generateRoute(
      new Request("http://localhost/api/ai/generate", {
        method: "POST",
        headers: { authorization: "Bearer test-token", "content-type": "application/json" },
        body: JSON.stringify({ siteId }),
      }),
    );
  }

  const today = quotaDay();

  beforeAll(async () => {
    ({ POST: generateRoute } = await import("@/app/api/ai/generate/route"));
    admin = (await import("@/lib/firebase/admin")).adminDb();
  });

  beforeEach(async () => {
    const res = await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
      method: "DELETE",
    });
    expect(res.ok).toBe(true);
    await admin.doc("sites/alice-site").set({ ...draftFields("alice"), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    await admin.doc("userQuotas/alice").set({
      openDraftSiteId: "alice-site",
      draftsCreatedToday: 1,
      draftsDay: today,
      aiDay: today,
      aiRequestsToday: 2,
      aiMonth: today.slice(0, 7),
      aiRequestsThisMonth: 2,
    });
    await admin.doc("siteAi/alice-site").set({ ownerUid: "alice", understandings: 1, generations: 1, lock: null });
  });

  afterAll(async () => {
    await Promise.all(clients.map((db) => terminate(db)));
    await Promise.all(apps.map((app) => deleteApp(app)));
  });

  describe("firestore.rules", () => {
    it("keeps the account's AI counts out of reach of every browser, including the account's own", async () => {
      const alice = browser("alice");
      const ref = doc(alice, "userQuotas", "alice");
      await denied(getDoc(ref));
      await denied(updateDoc(ref, { aiRequestsToday: 0, aiRequestsThisMonth: 0 }));
      await denied(setDoc(ref, { aiDay: "2000-01-01" }, { merge: true }));
      await denied(deleteDoc(ref));
      await denied(setDoc(doc(browser("guest-1", true), "userQuotas", "guest-1"), { aiRequestsToday: 0 }));

      expect((await admin.doc("userQuotas/alice").get()).data()).toMatchObject({ aiRequestsToday: 2, aiRequestsThisMonth: 2 });
    });

    it("keeps a website's AI counts and lock out of reach, even for its owner", async () => {
      const alice = browser("alice");
      const ref = doc(alice, "siteAi", "alice-site");
      await denied(getDoc(ref));
      await denied(updateDoc(ref, { generations: 0 }));
      await denied(updateDoc(ref, { lock: null }));
      await denied(setDoc(ref, { ownerUid: "alice", generations: 0, understandings: 0, lock: null }));
      await denied(deleteDoc(ref));
      await denied(setDoc(doc(alice, "siteAi", "another-site"), { ownerUid: "alice", generations: 0 }));
      await denied(getDoc(doc(browser("bob"), "siteAi", "alice-site")));

      // Nor can the counts be smuggled onto the site document the owner may edit.
      await denied(updateDoc(doc(alice, "sites", "alice-site"), { generations: 0, updatedAt: new Date() }));
      await denied(updateDoc(doc(alice, "sites", "alice-site"), { lock: null, updatedAt: new Date() }));

      expect((await admin.doc("siteAi/alice-site").get()).data()).toMatchObject({ generations: 1, understandings: 1, lock: null });
    });

    it("keeps the Webbi-wide AI budget out of reach of every browser", async () => {
      await admin.doc("aiBudget/day-2026-09-15").set({ period: "2026-09-15", count: 7 });
      const alice = browser("alice");
      const ref = doc(alice, "aiBudget", "day-2026-09-15");
      await denied(getDoc(ref));
      await denied(setDoc(ref, { period: "2026-09-15", count: 0 }));
      await denied(updateDoc(ref, { count: 0 }));
      await denied(deleteDoc(ref));
      await denied(setDoc(doc(alice, "aiBudget", "month-2026-09"), { period: "2026-09", count: 0 }));
      await denied(getDoc(doc(browser("guest-2", true), "aiBudget", "day-2026-09-15")));

      expect((await admin.doc("aiBudget/day-2026-09-15").get()).data()).toMatchObject({ count: 7 });
    });
  });

  describe("POST /api/ai/generate with real transactions", () => {
    it("lets exactly one of five simultaneous builds reach the provider and counts it once", async () => {
      const held = gate();
      const generate = vi.fn(async () => {
        await held.opened;
        return structuredClone(AI_SITE);
      });
      vi.mocked(getAiProvider).mockReturnValue({ name: "fake-model", generate, understand: async () => structuredClone(AI_UNDERSTANDING) });

      const alice: VerifiedUser = { uid: "alice", isAnonymous: false, email: "alice@example.com" };
      let answered = 0;
      const requests = Array.from({ length: 5 }, () =>
        build(alice, "alice-site").then((res) => {
          answered += 1;
          return res;
        }),
      );
      // Every refused request answers while the accepted one is still with the provider.
      await vi.waitFor(() => expect(answered).toBe(4), { timeout: 15_000, interval: 50 });
      expect(generate).toHaveBeenCalledTimes(1);
      held.open();

      const responses = await Promise.all(requests);
      const statuses = responses.map((res) => res.status);
      expect(statuses.filter((status) => status === 200)).toHaveLength(1);
      expect(statuses.filter((status) => status === 409)).toHaveLength(4);
      expect(generate).toHaveBeenCalledTimes(1);

      expect((await admin.doc("siteAi/alice-site").get()).data()).toMatchObject({ generations: 2, lock: null });
      expect((await admin.doc("userQuotas/alice").get()).data()).toMatchObject({ aiRequestsToday: 3, aiRequestsThisMonth: 3 });
      expect((await admin.doc("sites/alice-site").get()).data()).toMatchObject({ generation: { status: "ready", model: "fake-model" } });
    }, 30_000);
  });
});
