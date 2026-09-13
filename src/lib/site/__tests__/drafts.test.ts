import { createHmac } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { Timestamp } from "firebase-admin/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as callback } from "@/app/api/payments/webhook/route";
import { POST as checkout } from "@/app/api/publish/checkout/route";
import { POST as removeRoute } from "@/app/api/sites/delete/route";
import { POST as createRoute } from "@/app/api/sites/route";
import { requireUser, UnauthorizedError, type VerifiedUser } from "@/lib/auth/verify";
import { DEMO_SITES } from "@/lib/site/demo";
import { DAILY_DRAFT_LIMIT, quotaDay } from "@/lib/site/drafts";
import type { Understanding } from "@/lib/site/schema";
import { FakeFirestore } from "@/test/fakeFirestore";

/**
 * Phase A: one unpublished website per account and 3 website starts a day,
 * through Webbi's real route handlers, draft/publish code and Billplz adapter
 * (Billplz faked at fetch, Firestore faked in memory with real transaction
 * retries). The Firestore rules themselves run against the emulator in
 * drafts.emulator.test.ts (npm run test:rules).
 */

const firestore = vi.hoisted(() => ({ db: undefined as FakeFirestore | undefined }));

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: () => firestore.db,
  AdminNotConfiguredError: class AdminNotConfiguredError extends Error {},
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/auth/verify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/verify")>()),
  requireUser: vi.fn(),
}));

const SECRET = "secret-key-for-unit-tests-only";
const SIGNING_KEY = "x-signature-key-for-unit-tests-only";
const COLLECTION = "webbi_test_col";
const PAID_AT = "2026-09-13 10:15:09 +0800";
const DRAFT = Object.values(DEMO_SITES)[0];
const IN_PROGRESS = "You already have a website in progress. Finish or publish it before creating another website.";
const DAILY_LIMIT = "You've reached today's website creation limit. Please try again tomorrow.";

const UNDERSTANDING: Understanding = {
  language: "en",
  name: "Kedai Aisyah",
  category: "restaurant",
  categoryConfidence: "high",
  offerings: [{ name: "Nasi lemak", price: "RM6" }],
  highlights: ["Kampung dishes"],
  ctaLabel: "Order on WhatsApp",
  tone: "friendly",
  summary: "Nasi lemak and kampung dishes in Kajang.",
};

type Doc = Record<string, unknown>;
type Handler = (request: Request) => Promise<Response>;

let db: FakeFirestore;
let bills: Map<string, Doc>;
let people = 0;

function person(overrides: Partial<VerifiedUser> = {}): VerifiedUser {
  people += 1;
  return { uid: `owner-${people}`, isAnonymous: false, email: `owner${people}@example.com`, name: "Aisyah", ...overrides };
}

const site = (id: string): Doc | undefined => db.read(`sites/${id}`);
const quota = (uid: string): Doc | undefined => db.read(`userQuotas/${uid}`);
const sitesOf = (uid: string) => db.list("sites").filter((snap) => snap.data()?.ownerUid === uid);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** The Billplz production API, just enough for checkout and callbacks. */
function fakeBillplzApi() {
  bills = new Map();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = String(input);
      const method = init.method ?? "GET";
      const body = typeof init.body === "string" ? new URLSearchParams(init.body) : null;
      if (method === "POST" && url === "https://www.billplz.com/api/v3/bills" && body) {
        const id = `bill${String(bills.size + 1).padStart(4, "0")}`;
        const bill: Doc = {
          id,
          collection_id: body.get("collection_id"),
          paid: false,
          state: "due",
          amount: Number(body.get("amount")),
          paid_amount: 0,
          paid_at: null,
          due_at: "2026-9-13",
          email: body.get("email"),
          mobile: null,
          name: body.get("name"),
          description: body.get("description"),
          reference_1: body.get("reference_1"),
          reference_2: body.get("reference_2"),
          callback_url: body.get("callback_url"),
          redirect_url: body.get("redirect_url"),
          url: `https://www.billplz.com/bills/${id}`,
        };
        bills.set(id, bill);
        return json(200, bill);
      }
      const match = /^https:\/\/www\.billplz\.com\/api\/v3\/bills\/([^/?]+)$/.exec(url);
      const bill = method === "GET" && match ? bills.get(decodeURIComponent(match[1])) : undefined;
      return bill ? json(200, bill) : json(404, { error: { type: "RecordNotFound", message: "Not found" } });
    }),
  );
}

function callbackBody(bill: Doc): URLSearchParams {
  const fields: Record<string, string> = {
    id: String(bill.id),
    collection_id: String(bill.collection_id),
    paid: String(bill.paid),
    state: String(bill.state),
    amount: String(bill.amount),
    paid_amount: String(bill.paid_amount),
    due_at: String(bill.due_at),
    email: String(bill.email),
    mobile: "",
    name: String(bill.name),
    url: String(bill.url),
    paid_at: bill.paid_at ? String(bill.paid_at) : "",
  };
  const source = Object.entries(fields)
    .map(([name, value]) => `${name}${value}`)
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0))
    .join("|");
  const body = new URLSearchParams(fields);
  body.set("x_signature", createHmac("sha256", SIGNING_KEY).update(source).digest("hex"));
  return body;
}

async function call(handler: Handler, path: string, init: RequestInit) {
  const response = await handler(new Request(`https://webbi.online${path}`, { method: "POST", ...init }));
  return { status: response.status, body: (await response.json()) as Doc };
}

function send(user: VerifiedUser, handler: Handler, path: string, body: unknown) {
  vi.mocked(requireUser).mockResolvedValue(user);
  return call(handler, path, {
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const create = (user: VerifiedUser, extra: Doc = {}) =>
  send(user, createRoute, "/api/sites", {
    sourceDescription: "Nasi lemak and kampung dishes in Kajang.",
    understanding: UNDERSTANDING,
    ...extra,
  });

const remove = (user: VerifiedUser, siteId: string) => send(user, removeRoute, "/api/sites/delete", { siteId });

const postCallback = (bill: Doc) =>
  call(callback, "/api/payments/webhook", {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: callbackBody(bill).toString(),
  });

/** Creates a draft for `user` and fills it in the way the editor does, ready for checkout. */
async function readyDraft(user: VerifiedUser): Promise<string> {
  const res = await create(user);
  expect(res.status).toBe(201);
  const siteId = String(res.body.siteId);
  db.patch(`sites/${siteId}`, { draft: structuredClone(DRAFT), generation: { status: "ready" } });
  return siteId;
}

async function openBill(user: VerifiedUser, siteId: string) {
  const res = await send(user, checkout, "/api/publish/checkout", { siteId, slug: `kedai-${siteId.slice(0, 8).toLowerCase()}` });
  expect(res.status).toBe(200);
  const bill = bills.get(String(res.body.url).split("/").pop() ?? "");
  if (!bill) throw new Error("checkout didn't open a bill");
  return bill;
}

const pay = (bill: Doc, amount?: number) =>
  Object.assign(bill, { paid: true, state: "paid", paid_amount: amount ?? bill.amount, paid_at: PAID_AT });

async function publish(user: VerifiedUser, siteId: string) {
  const bill = await openBill(user, siteId);
  pay(bill);
  const res = await postCallback(bill);
  expect(res.status).toBe(200);
  expect(site(siteId)).toMatchObject({ status: "published", paid: true });
}

function legacyDraft(siteId: string, ownerUid: string, createdAt: string, overrides: Doc = {}): void {
  db.seed(`sites/${siteId}`, {
    ownerUid,
    status: "draft",
    paid: false,
    paidAt: null,
    slug: null,
    published: null,
    publishedAt: null,
    draft: structuredClone(DRAFT),
    sourceDescription: "An older draft",
    generation: { status: "ready" },
    language: "en",
    createdAt: Timestamp.fromDate(new Date(createdAt)),
    updatedAt: Timestamp.fromDate(new Date(createdAt)),
    ...overrides,
  });
}

beforeEach(() => {
  vi.stubEnv("PAYMENT_PROVIDER", "");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("BILLPLZ_BASE_URL", "https://www.billplz.com/api/");
  vi.stubEnv("BILLPLZ_SECRET_KEY", SECRET);
  vi.stubEnv("BILLPLZ_COLLECTION_ID", COLLECTION);
  vi.stubEnv("BILLPLZ_X_SIGNATURE_KEY", SIGNING_KEY);
  db = new FakeFirestore();
  firestore.db = db;
  fakeBillplzApi();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("one unpublished website per account", () => {
  it("lets an account start its first website, built entirely by the server", async () => {
    const owner = person();
    // None of the extra fields are read: owner, status, payment and quota come from the server.
    const res = await create(owner, {
      ownerUid: "someone-else",
      status: "published",
      paid: true,
      slug: "taken-slug",
      draftsCreatedToday: -5,
      openDraftSiteId: null,
    });

    expect(res.status).toBe(201);
    const siteId = String(res.body.siteId);
    expect(Object.keys(res.body)).toEqual(["siteId"]);
    expect(site(siteId)).toMatchObject({
      ownerUid: owner.uid,
      status: "draft",
      paid: false,
      paidAt: null,
      slug: null,
      published: null,
      publishedAt: null,
      draft: null,
      sourceDescription: "Nasi lemak and kampung dishes in Kajang.",
      generation: { status: "understood", understanding: UNDERSTANDING },
      language: "en",
    });
    expect(Object.keys(site(siteId) ?? {}).sort()).toEqual(
      [
        "createdAt",
        "draft",
        "generation",
        "language",
        "ownerUid",
        "paid",
        "paidAt",
        "published",
        "publishedAt",
        "slug",
        "sourceDescription",
        "status",
        "updatedAt",
      ].sort(),
    );
    expect(db.ids("sites")).toEqual([siteId]);
    expect(quota(owner.uid)).toMatchObject({ openDraftSiteId: siteId, draftsCreatedToday: 1, draftsDay: quotaDay() });
  });

  it("refuses a second unpublished website with 409 and points at the one in progress", async () => {
    const owner = person();
    const first = await create(owner);
    const second = await create(owner);

    expect(second.status).toBe(409);
    expect(second.body.error).toEqual({ code: "conflict", message: IN_PROGRESS, existingSiteId: first.body.siteId });
    expect(sitesOf(owner.uid)).toHaveLength(1);
    // A refusal isn't a start.
    expect(quota(owner.uid)).toMatchObject({ openDraftSiteId: first.body.siteId, draftsCreatedToday: 1 });
  });

  it("doesn't let one account's draft block another account", async () => {
    const aisyah = person();
    const hafiz = person();
    const a = await create(aisyah);
    const h = await create(hafiz);

    expect([a.status, h.status]).toEqual([201, 201]);
    expect(site(String(h.body.siteId))?.ownerUid).toBe(hafiz.uid);
    expect(quota(aisyah.uid)?.openDraftSiteId).toBe(a.body.siteId);
    expect(quota(hafiz.uid)?.openDraftSiteId).toBe(h.body.siteId);
  });

  it("keeps the slot through checkout, and frees it once the website is live", async () => {
    const owner = person();
    const siteA = await readyDraft(owner);
    const bill = await openBill(owner, siteA);
    // Opening checkout (a pending payment) is not publishing.
    expect(quota(owner.uid)?.openDraftSiteId).toBe(siteA);
    expect((await create(owner)).status).toBe(409);

    pay(bill);
    expect((await postCallback(bill)).body).toMatchObject({ received: true });
    expect(site(siteA)).toMatchObject({ status: "published", paid: true });
    expect(quota(owner.uid)?.openDraftSiteId).toBeNull();

    // Website B is a new website with its own draft and its own payment.
    const siteB = await create(owner);
    expect(siteB.status).toBe(201);
    expect(site(String(siteB.body.siteId))).toMatchObject({ status: "draft", paid: false, slug: null });
    expect(quota(owner.uid)).toMatchObject({ openDraftSiteId: siteB.body.siteId, draftsCreatedToday: 2 });
  });

  it("keeps the slot while the payment is still pending", async () => {
    const owner = person();
    const siteId = await readyDraft(owner);
    const bill = await openBill(owner, siteId);

    expect((await postCallback(bill)).body).toEqual({ received: true, pending: true });
    expect(site(siteId)?.status).toBe("draft");
    expect(quota(owner.uid)?.openDraftSiteId).toBe(siteId);
    expect((await create(owner)).status).toBe(409);
  });

  it("keeps the slot when the payment fails", async () => {
    const owner = person();
    const siteId = await readyDraft(owner);
    const bill = await openBill(owner, siteId);
    bill.state = "deleted";

    expect((await postCallback(bill)).body).toEqual({ received: true, failed: true });
    expect(db.list("payments")[0].data()?.status).toBe("failed");
    expect(site(siteId)?.status).toBe("draft");
    expect(quota(owner.uid)?.openDraftSiteId).toBe(siteId);
    expect((await create(owner)).status).toBe(409);
  });

  it("keeps the slot when a payment can't publish (wrong amount, broken draft)", async () => {
    for (const problem of ["amount_mismatch", "invalid_draft"] as const) {
      const owner = person();
      const siteId = await readyDraft(owner);
      const bill = await openBill(owner, siteId);
      if (problem === "invalid_draft") db.patch(`sites/${siteId}`, { draft: { nonsense: true } });
      pay(bill, problem === "amount_mismatch" ? 100 : undefined);
      expect((await postCallback(bill)).body).toMatchObject({ received: true, published: false, needsAttention: true });

      expect(site(siteId)).toMatchObject({ status: "draft", paid: false, slug: null });
      expect(quota(owner.uid)?.openDraftSiteId).toBe(siteId);
      expect((await create(owner)).status).toBe(409);
    }
  });

  it("doesn't touch the lock when a later edit of a live website is republished or paid twice", async () => {
    const owner = person();
    const siteA = await readyDraft(owner);
    await publish(owner, siteA);
    const siteB = String((await create(owner)).body.siteId);

    // A second, duplicate payment for website A must not free website B's slot.
    const again = { ...(await openBillForPublished(owner, siteA)) };
    pay(again);
    await postCallback(again);
    expect(quota(owner.uid)?.openDraftSiteId).toBe(siteB);
  });
});

/** A checkout for an already-live website can't be opened through the route, so record one directly. */
async function openBillForPublished(owner: VerifiedUser, siteId: string): Promise<Doc> {
  const paymentId = "duplicate-payment";
  db.seed(`payments/${paymentId}`, {
    siteId,
    ownerUid: owner.uid,
    slug: String(site(siteId)?.slug),
    amountSen: 14990,
    currency: "myr",
    provider: "billplz",
    providerRef: "bill9999",
    status: "pending",
    failureReason: null,
    paidAt: null,
  });
  const bill: Doc = {
    id: "bill9999",
    collection_id: COLLECTION,
    paid: false,
    state: "due",
    amount: 14990,
    paid_amount: 0,
    paid_at: null,
    due_at: "2026-9-13",
    email: owner.email,
    mobile: null,
    name: "Aisyah",
    reference_1: paymentId,
    reference_2: siteId,
    url: "https://www.billplz.com/bills/bill9999",
  };
  bills.set("bill9999", bill);
  return bill;
}

describe("deleting a draft", () => {
  it("frees the slot but never gives back a start", async () => {
    const owner = person();
    const siteId = String((await create(owner)).body.siteId);

    const res = await remove(owner, siteId);
    expect(res).toEqual({ status: 200, body: { deleted: true } });
    expect(site(siteId)).toBeUndefined();
    expect(quota(owner.uid)).toMatchObject({ openDraftSiteId: null, draftsCreatedToday: 1 });

    const next = await create(owner);
    expect(next.status).toBe(201);
    expect(quota(owner.uid)).toMatchObject({ openDraftSiteId: next.body.siteId, draftsCreatedToday: 2 });
  });

  it("only deletes the caller's own unpaid draft", async () => {
    const owner = person();
    const stranger = person();
    const siteA = await readyDraft(owner);

    expect((await remove(stranger, siteA)).status).toBe(404);
    expect(site(siteA)).toBeDefined();
    expect(quota(owner.uid)?.openDraftSiteId).toBe(siteA);

    await publish(owner, siteA);
    expect((await remove(owner, siteA)).status).toBe(409);
    expect(site(siteA)?.status).toBe("published");

    expect((await remove(owner, "../userQuotas/x")).status).toBe(400);
  });

  it("releases the lock only when it points at the deleted draft", async () => {
    const owner = person();
    legacyDraft("legacy-old", owner.uid, "2026-01-01T00:00:00Z");
    legacyDraft("legacy-new", owner.uid, "2026-02-01T00:00:00Z");
    expect((await create(owner)).body.error).toMatchObject({ existingSiteId: "legacy-old" });

    expect((await remove(owner, "legacy-new")).status).toBe(200);
    expect(quota(owner.uid)?.openDraftSiteId).toBe("legacy-old");
  });
});

describe("3 website starts a day", () => {
  it("allows three starts in a server day and refuses the fourth with 429", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T02:00:00Z")); // 10:00 in Malaysia
    const owner = person();

    for (let i = 1; i <= DAILY_DRAFT_LIMIT; i++) {
      const res = await create(owner);
      expect(res.status).toBe(201);
      expect(quota(owner.uid)).toMatchObject({ draftsCreatedToday: i, draftsDay: "2026-09-13" });
      expect((await remove(owner, String(res.body.siteId))).status).toBe(200);
    }

    const fourth = await create(owner);
    expect(fourth.status).toBe(429);
    expect(fourth.body.error).toEqual({ code: "rate_limited", message: DAILY_LIMIT });
    expect(sitesOf(owner.uid)).toHaveLength(0);
    expect(quota(owner.uid)).toMatchObject({ openDraftSiteId: null, draftsCreatedToday: 3 });
  });

  it("counts the day in Malaysia on the server, and starts again at midnight there", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T15:59:00Z")); // 23:59 on the 13th in Malaysia
    const owner = person();
    for (let i = 0; i < DAILY_DRAFT_LIMIT; i++) {
      await remove(owner, String((await create(owner)).body.siteId));
    }
    expect((await create(owner)).status).toBe(429);

    vi.setSystemTime(new Date("2026-09-13T16:00:00Z")); // 00:00 on the 14th in Malaysia
    const tomorrow = await create(owner);
    expect(tomorrow.status).toBe(201);
    expect(quota(owner.uid)).toMatchObject({ draftsCreatedToday: 1, draftsDay: "2026-09-14" });
  });

  it("names the day from the server clock only", () => {
    expect(quotaDay(new Date("2026-12-31T15:59:59Z"))).toBe("2026-12-31");
    expect(quotaDay(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
  });
});

describe("simultaneous requests", () => {
  it("lets exactly one of two simultaneous starts through", async () => {
    const owner = person();
    const results = await Promise.all([create(owner), create(owner)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const created = results.find((r) => r.status === 201)?.body.siteId;
    const refused = results.find((r) => r.status === 409)?.body.error as Doc;
    expect(sitesOf(owner.uid).map((snap) => snap.id)).toEqual([created]);
    expect(refused.existingSiteId).toBe(created);
    expect(quota(owner.uid)).toMatchObject({ openDraftSiteId: created, draftsCreatedToday: 1 });
    expect(db.conflicts).toBeGreaterThan(0); // they really did collide, and the loser was retried
  });

  it("holds under a burst of ten", async () => {
    const owner = person();
    const results = await Promise.all(Array.from({ length: 10 }, () => create(owner)));

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(9);
    const [only] = sitesOf(owner.uid);
    expect(sitesOf(owner.uid)).toHaveLength(1);
    expect(quota(owner.uid)).toMatchObject({ openDraftSiteId: only.id, draftsCreatedToday: 1 });
  });

  it("never leaves a stale or missing lock when publishing A races starting B", async () => {
    for (const order of ["publish-first", "create-first"] as const) {
      const owner = person();
      const siteA = await readyDraft(owner);
      const bill = await openBill(owner, siteA);
      pay(bill);

      const [paid, started] =
        order === "publish-first"
          ? await Promise.all([postCallback(bill), create(owner)])
          : await Promise.all([create(owner), postCallback(bill)]).then(([s, p]) => [p, s] as const);

      expect(paid.status).toBe(200);
      expect(site(siteA)?.status).toBe("published");
      const open = sitesOf(owner.uid).filter((snap) => snap.data()?.status !== "published");
      expect(open.length).toBeLessThanOrEqual(1);
      if (started.status === 201) {
        expect(open.map((snap) => snap.id)).toEqual([started.body.siteId]);
        expect(quota(owner.uid)?.openDraftSiteId).toBe(started.body.siteId);
      } else {
        expect(started.status).toBe(409);
        expect(open).toHaveLength(0);
        expect(quota(owner.uid)?.openDraftSiteId).toBeNull();
        expect((await create(owner)).status).toBe(201);
      }
    }
  });
});

describe("who can start a website", () => {
  it("refuses a request without a valid sign-in", async () => {
    vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError("Sign in to continue."));
    const res = await call(createRoute, "/api/sites", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceDescription: "Nasi lemak in Kajang, order by WhatsApp.", understanding: UNDERSTANDING }),
    });
    expect(res.status).toBe(401);
    expect(db.ids("sites")).toEqual([]);
  });

  it("refuses a guest (anonymous) session", async () => {
    const guest = person({ isAnonymous: true, email: undefined });
    const res = await create(guest);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: "forbidden" });
    expect(db.ids("sites")).toEqual([]);
    expect(db.ids("userQuotas")).toEqual([]);
  });

  it("answers bad input with 400 and no internals", async () => {
    const owner = person();
    const cases: unknown[] = [
      null,
      { sourceDescription: "short", understanding: UNDERSTANDING },
      { sourceDescription: "x".repeat(4001), understanding: UNDERSTANDING },
      { sourceDescription: "Nasi lemak in Kajang, order by WhatsApp.", understanding: { ...UNDERSTANDING, language: "fr" } },
    ];
    for (const body of cases) {
      const res = await send(owner, createRoute, "/api/sites", body);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: "bad_request" });
    }
    const garbled = await call(createRoute, "/api/sites", { headers: { "content-type": "application/json" }, body: "{not json" });
    expect(garbled.status).toBe(400);
    expect(db.ids("sites")).toEqual([]);
  });

  it("doesn't leak internals when Firestore itself fails", async () => {
    const owner = person();
    vi.spyOn(db, "runTransaction").mockRejectedValue(new Error("FIRESTORE_EMULATOR_HOST 13 INTERNAL at adminDb()"));
    const res = await create(owner);
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/FIRESTORE|INTERNAL|adminDb|stack/);
  });
});

describe("accounts from before the limit", () => {
  it("keeps every existing draft untouched and treats the oldest as the one in progress", async () => {
    const owner = person();
    legacyDraft("draft-2", owner.uid, "2026-03-01T00:00:00Z");
    legacyDraft("draft-1", owner.uid, "2026-01-01T00:00:00Z");
    legacyDraft("draft-3", owner.uid, "2026-05-01T00:00:00Z");
    legacyDraft("live-1", owner.uid, "2025-12-01T00:00:00Z", { status: "published", paid: true, slug: "live-1" });
    const before = Object.fromEntries(db.list("sites").map((snap) => [snap.id, snap.data()]));

    const res = await create(owner);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ existingSiteId: "draft-1" });
    expect(Object.fromEntries(db.list("sites").map((snap) => [snap.id, snap.data()]))).toEqual(before);
    expect(quota(owner.uid)).toMatchObject({ openDraftSiteId: "draft-1", draftsCreatedToday: 0 });

    // Deleting the oldest moves on to the next oldest: still no new website until all are finished.
    expect((await remove(owner, "draft-1")).status).toBe(200);
    expect((await create(owner)).body.error).toMatchObject({ existingSiteId: "draft-2" });
  });

  it("lets an account with only live websites (and no quota record) start one", async () => {
    const owner = person();
    legacyDraft("live-1", owner.uid, "2026-01-01T00:00:00Z", { status: "published", paid: true, slug: "live-1" });
    const res = await create(owner);
    expect(res.status).toBe(201);
    expect(quota(owner.uid)).toMatchObject({ openDraftSiteId: res.body.siteId, draftsCreatedToday: 1 });
  });

  it("ignores a lock left pointing at a website that is gone or live", async () => {
    const owner = person();
    db.seed(`userQuotas/${owner.uid}`, { openDraftSiteId: "vanished", draftsCreatedToday: 1, draftsDay: quotaDay() });
    expect((await create(owner)).status).toBe(201);

    const other = person();
    legacyDraft("live-2", other.uid, "2026-01-01T00:00:00Z", { status: "published", paid: true, slug: "live-2" });
    db.seed(`userQuotas/${other.uid}`, { openDraftSiteId: "live-2", draftsCreatedToday: 0, draftsDay: quotaDay() });
    expect((await create(other)).status).toBe(201);
  });
});

describe("no way around the server", () => {
  const ROOT = join(__dirname, "../../../..");
  const read = (file: string) => readFileSync(join(ROOT, file), "utf8");
  function walk(dir: string): string[] {
    return readdirSync(join(ROOT, dir)).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(join(ROOT, path)).isDirectory()) return name === "__tests__" ? [] : walk(path);
      return /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  }

  it("has no browser code that writes a site document directly (the old guest handoff included)", () => {
    // The moderation core has no "server-only" import only so the ops CLI can run
    // it under Node. It takes an Admin SDK Firestore, never loads the browser SDK,
    // and nothing but the server wrapper and the CLI imports it.
    const CORE = "src/lib/site/moderationCore.ts";
    expect(read(CORE)).not.toMatch(/from "firebase\/|from "@\/lib\/firebase\/client/);
    expect(read(CORE)).toMatch(/import type \{[^}]*\} from "firebase-admin\/firestore"/);
    const importers = walk("src").filter((file) => file !== CORE && /moderationCore["']/.test(read(file)));
    for (const file of importers) expect(read(file), file).not.toMatch(/^["']use client["']/m);
    expect(read("scripts/ops/moderate.mjs")).toContain("moderationCore.ts");
    const client = walk("src").filter(
      (file) => file !== CORE && !file.startsWith("src/app/api/") && !read(file).includes('import "server-only"'),
    );
    const writers = client.filter((file) => /\b(addDoc|setDoc|deleteDoc|writeBatch|runTransaction)\s*\(/.test(read(file)));
    // Only the profile upsert (users/{uid}) writes with setDoc.
    expect(writers.map((file) => relative(ROOT, join(ROOT, file)))).toEqual(["src/lib/auth/actions.ts"]);
    expect(read("src/lib/auth/actions.ts")).not.toMatch(/collection\([^)]*["']sites["']|["']sites\//);
    expect(walk("src").filter((file) => read(file).includes("copySiteToOwner"))).toEqual([]);
    expect(read("src/app/(app)/s/[siteId]/account/AccountView.tsx")).not.toMatch(/handoff/);
  });

  it("ships rules that refuse client creates and deletes of sites and any access to userQuotas", () => {
    const rules = read("firestore.rules");
    const block = (name: string) => rules.slice(rules.indexOf(`match /${name}/`), rules.indexOf("match /", rules.indexOf(`match /${name}/`) + 1));
    expect(block("sites")).toMatch(/allow create, delete: if false;/);
    expect(block("sites")).not.toMatch(/allow (write|create)[^;]*if (?!false)/);
    expect(block("userQuotas")).toMatch(/allow read, write: if false;/);
    expect(block("userQuotas")).not.toMatch(/if (?!false)/);
  });
});
