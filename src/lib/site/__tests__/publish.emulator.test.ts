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
import { DEMO_SITES } from "@/lib/site/demo";

/**
 * Phase D against the real Firestore emulator: browsers can't create or change
 * payments, and simultaneous fulfilments of one paid payment publish once with
 * real Admin SDK transactions. Run with `npm run test:rules`.
 */

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-webbi";
});
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = "demo-webbi";

describe.runIf(Boolean(HOST))("Phase D on the Firestore emulator", () => {
  let admin: import("firebase-admin/firestore").Firestore;
  let retryPaymentFulfilment: typeof import("@/lib/site/publish").retryPaymentFulfilment;
  const apps: FirebaseApp[] = [];
  const clients: Firestore[] = [];

  function browser(uid: string): Firestore {
    const app = initializeApp({ projectId: PROJECT, apiKey: "fake-api-key" }, `${uid}-${apps.length}`);
    const db = getFirestore(app);
    const [host, port] = String(HOST).split(":");
    connectFirestoreEmulator(db, host, Number(port), {
      mockUserToken: {
        sub: uid,
        user_id: uid,
        email: `${uid}@example.com`,
        firebase: { sign_in_provider: "password", identities: {} },
      } as never,
    });
    apps.push(app);
    clients.push(db);
    return db;
  }

  const denied = (promise: Promise<unknown>) => expect(promise).rejects.toMatchObject({ code: "permission-denied" });

  const PAYMENT = {
    siteId: "alice-draft",
    ownerUid: "alice",
    slug: "kedai-alice",
    amountSen: 14990,
    currency: "myr",
    provider: "billplz",
    providerRef: "bill0001",
    checkoutUrl: "https://www.billplz.com/bills/bill0001",
    failureReason: null,
  };

  beforeAll(async () => {
    admin = (await import("@/lib/firebase/admin")).adminDb();
    ({ retryPaymentFulfilment } = await import("@/lib/site/publish"));
  });

  beforeEach(async () => {
    const res = await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
      method: "DELETE",
    });
    expect(res.ok).toBe(true);
    const now = Timestamp.now();
    await admin.doc("sites/alice-draft").set({
      ownerUid: "alice",
      status: "draft",
      paid: false,
      paidAt: null,
      slug: null,
      published: null,
      publishedAt: null,
      draft: structuredClone(Object.values(DEMO_SITES)[0]),
      sourceDescription: "",
      generation: { status: "ready" },
      language: "en",
      createdAt: now,
      updatedAt: now,
    });
    await admin.doc("userQuotas/alice").set({ openDraftSiteId: "alice-draft" });
    await admin.doc("payments/pending-1").set({ ...PAYMENT, status: "pending", paidAt: null, createdAt: now, updatedAt: now });
  });

  afterAll(async () => {
    await Promise.all(clients.map((db) => terminate(db)));
    await Promise.all(apps.map((app) => deleteApp(app)));
  });

  it("lets the owner read a payment but no browser create or change one", async () => {
    const alice = browser("alice");
    expect((await getDoc(doc(alice, "payments", "pending-1"))).data()?.status).toBe("pending");
    await denied(getDoc(doc(browser("bob"), "payments", "pending-1")));

    const forged = { ...PAYMENT, status: "paid", paidAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
    await denied(addDoc(collection(alice, "payments"), forged));
    await denied(setDoc(doc(alice, "payments", "forged"), forged));
    for (const change of [
      { status: "paid" },
      { amountSen: 1 },
      { providerRef: "bill9999" },
      { ownerUid: "bob" },
      { siteId: "other" },
      { needsAttention: false },
      { fulfilledAt: new Date() },
    ]) {
      await denied(updateDoc(doc(alice, "payments", "pending-1"), change));
    }
    await denied(deleteDoc(doc(alice, "payments", "pending-1")));
    expect((await admin.doc("payments/pending-1").get()).data()).toMatchObject({ status: "pending", amountSen: 14990 });
    expect((await admin.collection("payments").get()).size).toBe(1);
  });

  it("publishes a paid payment exactly once when fulfilled many times at once, then frees the slot", async () => {
    const now = Timestamp.now();
    await admin.doc("payments/paid-1").set({
      ...PAYMENT,
      status: "paid",
      paidAt: now,
      paidAmountSen: 14990,
      needsAttention: true,
      attentionReason: "fulfilment_pending",
      fulfilledAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const results = await Promise.all(Array.from({ length: 6 }, () => retryPaymentFulfilment("paid-1")));
    expect(results.filter((result) => result.published)).toHaveLength(1);
    expect(results.every((result) => result.slug === "kedai-alice")).toBe(true);

    expect((await admin.collection("publicSites").get()).docs.map((snap) => snap.id)).toEqual(["kedai-alice"]);
    expect((await admin.doc("sites/alice-draft").get()).data()).toMatchObject({
      status: "published",
      paid: true,
      slug: "kedai-alice",
      paymentId: "paid-1",
    });
    expect((await admin.doc("payments/paid-1").get()).data()).toMatchObject({ status: "paid", needsAttention: false });
    expect((await admin.doc("userQuotas/alice").get()).data()?.openDraftSiteId).toBeNull();
    // A pending payment is never published by a retry.
    await expect(retryPaymentFulfilment("pending-1")).rejects.toMatchObject({ code: "conflict" });
  });
});
