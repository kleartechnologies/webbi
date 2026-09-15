import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, setDoc, terminate, type Firestore } from "firebase/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The admin panel against the real Firestore emulator: the deployed
 * firestore.rules keep every browser (the owner's own token included) out of
 * admin data and other customers' documents, and the server-side readers
 * paginate and never return checkout URLs. Firebase Auth is faked.
 * Run with `npm run test:rules` (skipped by plain `npm test`).
 */

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-webbi";
});

const AUTH_USERS = [
  { localId: "owner-uid", email: "owner@example.com", emailVerified: true, providerUserInfo: [{ providerId: "google.com" }], createdAt: String(Date.now()), passwordHash: "x", salt: "y", customAttributes: '{"webbiRole":"owner"}' },
  { localId: "customer-uid", email: "customer@example.com", emailVerified: false, providerUserInfo: [{ providerId: "password" }], createdAt: String(Date.now() - 40 * 86400_000), passwordHash: "x", salt: "y" },
];

vi.mock("@/lib/auth/accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/accounts")>()),
  identityToolkit: vi.fn(async (action: string) => (action === ":batchGet" ? { users: AUTH_USERS } : { users: [] })),
  lookupRawAccounts: vi.fn(async (query: { localId?: string[]; email?: string[] }) =>
    AUTH_USERS.filter((user) => query.localId?.includes(user.localId) || query.email?.includes(user.email)),
  ),
}));

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = "demo-webbi";

async function clearFirestore() {
  const response = await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  if (!response.ok) throw new Error(`clearing the emulator failed: ${response.status}`);
}

const apps: FirebaseApp[] = [];

function browserAs(uid: string, extra: Record<string, unknown> = {}): Firestore {
  const app = initializeApp({ projectId: PROJECT, apiKey: "fake-api-key" }, `admin-${uid}-${apps.length}`);
  apps.push(app);
  const db = getFirestore(app);
  const [host, port] = HOST!.split(":");
  connectFirestoreEmulator(db, host, Number(port), {
    mockUserToken: {
      sub: uid,
      user_id: uid,
      email: `${uid}@example.com`,
      email_verified: true,
      firebase: { sign_in_provider: "google.com", identities: {} },
      ...extra,
    } as never,
  });
  return db;
}

const denied = (promise: Promise<unknown>) => expect(promise).rejects.toMatchObject({ code: "permission-denied" });

describe.runIf(Boolean(HOST))("admin panel against the Firestore emulator", () => {
  let admin: FirebaseFirestore.Firestore;

  beforeAll(async () => {
    await clearFirestore();
    admin = (await import("@/lib/firebase/admin")).adminDb();
    const now = Timestamp.now();
    const batch = admin.batch();
    batch.set(admin.doc("adminMetrics/overview"), { data: { users: { total: 1 } }, computedAt: now, version: 1 });
    batch.set(admin.doc("adminAuditLogs/session-owner-uid-1"), { type: "ADMIN_SESSION_START", uid: "owner-uid", authTime: 1, at: now });
    batch.set(admin.doc("sites/site-a"), {
      ownerUid: "customer-uid",
      status: "published",
      paid: true,
      slug: "kedai-a",
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      draft: { business: { name: "Kedai A", category: "bakery", phone: "+60111" }, theme: { preset: "warm" } },
    });
    batch.set(admin.doc("sites/site-b"), { ownerUid: "customer-uid", status: "draft", paid: false, createdAt: now, updatedAt: now, draft: { business: { name: "Kedai B" } } });
    for (const [id, status, extra] of [
      ["pay-1", "paid", { paidAt: now, paidAmountSen: 14990 }],
      ["pay-2", "pending", {}],
      ["pay-3", "paid", { paidAt: now, paidAmountSen: 14990, needsAttention: true, attentionReason: "duplicate" }],
    ] as const) {
      batch.set(admin.doc(`payments/${id}`), {
        siteId: "site-a",
        ownerUid: "customer-uid",
        amountSen: 14990,
        currency: "myr",
        provider: "billplz",
        providerRef: `bill-${id}`,
        checkoutUrl: `https://www.billplz.com/bills/bill-${id}`,
        status,
        createdAt: now,
        updatedAt: now,
        ...extra,
      });
    }
    batch.set(admin.doc("userQuotas/customer-uid"), { openDraftSiteId: "site-b" });
    batch.set(admin.doc("siteAi/site-a"), { ownerUid: "customer-uid", generations: 1, understandings: 1, updatedAt: now });
    batch.set(admin.doc("siteModeration/site-a"), { moderationStatus: "active", moderationReason: "internal note" });
    await batch.commit();
  });

  afterAll(async () => {
    await Promise.all(apps.map(async (app) => {
      await terminate(getFirestore(app));
      await deleteApp(app);
    }));
  });

  describe("firestore.rules", () => {
    it("no signed-in browser can read or write admin metrics or audit logs", async () => {
      const db = browserAs("customer-uid");
      await denied(getDoc(doc(db, "adminMetrics/overview")));
      await denied(getDocs(collection(db, "adminMetrics")));
      await denied(getDoc(doc(db, "adminAuditLogs/session-owner-uid-1")));
      await denied(getDocs(collection(db, "adminAuditLogs")));
      await denied(setDoc(doc(db, "adminMetrics/overview"), { data: {} }));
      await denied(setDoc(doc(db, "adminAuditLogs/forged"), { type: "ADMIN_SESSION_START" }));
    });

    it("the owner claim grants a browser nothing: admin data stays server-only", async () => {
      const db = browserAs("owner-uid", { webbiRole: "owner" });
      await denied(getDoc(doc(db, "adminMetrics/overview")));
      await denied(getDocs(collection(db, "adminAuditLogs")));
      await denied(setDoc(doc(db, "adminAuditLogs/forged"), { type: "ADMIN_SESSION_START" }));
      await denied(getDocs(collection(db, "payments")));
      await denied(getDocs(collection(db, "sites")));
      await denied(getDoc(doc(db, "sites/site-a")));
      await denied(getDoc(doc(db, "payments/pay-1")));
      await denied(getDoc(doc(db, "userQuotas/customer-uid")));
      await denied(getDoc(doc(db, "siteModeration/site-a")));
      await denied(getDocs(collection(db, "aiBudget")));
    });

    it("a customer can't read another customer's documents", async () => {
      const db = browserAs("stranger-uid");
      await denied(getDoc(doc(db, "sites/site-a")));
      await denied(getDoc(doc(db, "payments/pay-1")));
      await denied(getDoc(doc(db, "userQuotas/customer-uid")));
      await denied(getDoc(doc(db, "siteAi/site-a")));
      await denied(getDocs(collection(db, "users")));
    });
  });

  describe("server-side readers", () => {
    it("lists payments without checkout URLs, paginated", async () => {
      const { listPayments } = await import("../payments");
      const { forbiddenKeys } = await import("../dto");
      const first = await listPayments({ view: "recent", limit: 2 });
      expect(first.payments).toHaveLength(2);
      expect(first.nextCursor).not.toBeNull();
      const second = await listPayments({ view: "recent", limit: 2, cursor: first.nextCursor! });
      expect(second.payments).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
      const all = [...first.payments, ...second.payments];
      expect(new Set(all.map((p) => p.id))).toEqual(new Set(["pay-1", "pay-2", "pay-3"]));
      expect(JSON.stringify(all)).not.toMatch(/checkoutUrl|billplz\.com\/bills/);
      expect(forbiddenKeys(all)).toEqual([]);
      expect(all.find((p) => p.id === "pay-1")?.ownerEmail).toBe("customer@example.com");
      const refunds = await listPayments({ view: "refund", limit: 25 });
      expect(refunds.payments.map((p) => p.id)).toEqual(["pay-3"]);
    });

    it("refuses a cursor for a document that doesn't exist", async () => {
      const { listPayments } = await import("../payments");
      const { listSites } = await import("../sites");
      const { AdminBadRequestError } = await import("../errors");
      await expect(listPayments({ view: "recent", limit: 2, cursor: "no-such-payment" })).rejects.toBeInstanceOf(AdminBadRequestError);
      await expect(listSites({ filter: "all", limit: 2, cursor: "no-such-site" })).rejects.toBeInstanceOf(AdminBadRequestError);
    });

    it("lists websites with names but no content", async () => {
      const { listSites } = await import("../sites");
      const { sites } = await listSites({ filter: "all", limit: 50 });
      expect(sites.map((s) => s.businessName).sort()).toEqual(["Kedai A", "Kedai B"]);
      expect(JSON.stringify(sites)).not.toContain("+60111");
      const published = await listSites({ filter: "published", limit: 50 });
      expect(published.sites.map((s) => s.id)).toEqual(["site-a"]);
    });

    it("joins users with their totals from Firebase Auth, never returning secrets", async () => {
      const { listUsers } = await import("../users");
      const { forbiddenKeys } = await import("../dto");
      const { users } = await listUsers({ limit: 25 });
      const customer = users.find((u) => u.uid === "customer-uid");
      expect(customer).toMatchObject({ websites: 2, live: 1, drafts: 1, paidOrders: 2, paidSen: 29980 });
      expect(JSON.stringify(users)).not.toMatch(/passwordHash|salt|webbiRole/);
      expect(forbiddenKeys(users)).toEqual([]);
    });

    it("computes and caches the overview in adminMetrics", async () => {
      const { getOverview } = await import("../metrics");
      await admin.doc("adminMetrics/overview").delete();
      const snapshot = await getOverview();
      expect(snapshot.refreshed).toBe(true);
      expect(snapshot.data.users.total).toBe(2);
      expect(snapshot.data.websites).toMatchObject({ total: 2, drafts: 1, live: 1 });
      expect(snapshot.data.revenue).toMatchObject({ paidOrders: 2, collectedAllTimeSen: 29980, pendingBills: 1, needsAttention: 1, needsRefund: 1 });
      expect((await admin.doc("adminMetrics/overview").get()).exists).toBe(true);
      const cached = await getOverview({ refresh: true });
      expect(cached.refreshed).toBe(false);
    });
  });
});
