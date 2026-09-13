import { createHmac } from "node:crypto";
import { revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as callback } from "@/app/api/payments/webhook/route";
import { POST as checkout } from "@/app/api/publish/checkout/route";
import { POST as confirm } from "@/app/api/publish/confirm/route";
import { POST as removeRoute } from "@/app/api/sites/delete/route";
import { requireUser, UnauthorizedError, type VerifiedUser } from "@/lib/auth/verify";
import { DEMO_SITES } from "@/lib/site/demo";
import { PublishError, retryPaymentFulfilment } from "@/lib/site/publish";
import { FakeFirestore } from "@/test/fakeFirestore";

/**
 * Phase D: payment resilience. Every way a Billplz payment can arrive (callback,
 * return page, both, repeated, at once) through Webbi's real routes and publish
 * code, with Billplz faked at fetch and Firestore faked in memory with real
 * transaction retries. No real payment is ever made; the keys are made up here.
 */

const firestore = vi.hoisted(() => ({ db: undefined as FakeFirestore | undefined }));

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: () => firestore.db,
  AdminNotConfiguredError: class AdminNotConfiguredError extends Error {},
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/images/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/images/storage")>()),
  deleteSiteImages: vi.fn(async () => {}),
}));
vi.mock("@/lib/auth/verify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/verify")>()),
  requireUser: vi.fn(),
}));

const SECRET = "secret-key-for-unit-tests-only";
const SIGNING_KEY = "x-signature-key-for-unit-tests-only";
const COLLECTION = "webbi_test_col";
const PAID_AT = "2026-09-13 10:15:09 +0800";
const DRAFT = Object.values(DEMO_SITES)[0];
const SLUG = "kedai-aisyah";

type Doc = Record<string, unknown>;
type Handler = (request: Request) => Promise<Response>;

let db: FakeFirestore;
let billplz: ReturnType<typeof fakeBillplzApi>;
let people = 0;

function person(): VerifiedUser {
  people += 1;
  return { uid: `payer-${people}`, isAnonymous: false, email: `payer${people}@example.com`, name: "Aisyah" };
}

function seedSite(siteId: string, ownerUid: string, overrides: Doc = {}): void {
  db.seed(`sites/${siteId}`, {
    ownerUid,
    status: "draft",
    paid: false,
    paidAt: null,
    slug: null,
    published: null,
    publishedAt: null,
    draft: structuredClone(DRAFT),
    sourceDescription: "",
    generation: { status: "ready" },
    language: "en",
    ...overrides,
  });
  db.seed(`userQuotas/${ownerUid}`, { openDraftSiteId: siteId, draftsCreatedToday: 1 });
}

const site = (id: string): Doc => db.read(`sites/${id}`) ?? {};
const payment = (id: string): Doc => db.read(`payments/${id}`) ?? {};
const lock = (uid: string) => db.read(`userQuotas/${uid}`)?.openDraftSiteId;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Stands in for the Billplz API: bills are created, read back and paid here. */
function fakeBillplzApi() {
  const bills = new Map<string, Doc>();
  const requests: Array<{ method: string; url: string }> = [];
  let created = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = String(input);
      const method = init.method ?? "GET";
      requests.push({ method, url });
      const body = typeof init.body === "string" ? new URLSearchParams(init.body) : null;
      if (method === "POST" && url === "https://www.billplz.com/api/v3/bills" && body) {
        const id = `bill${String(++created).padStart(4, "0")}`;
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
  return {
    bills,
    pay(id: string, amount?: number) {
      const bill = bills.get(id);
      if (!bill) throw new Error(`no bill ${id}`);
      Object.assign(bill, { paid: true, state: "paid", paid_amount: amount ?? bill.amount, paid_at: PAID_AT });
    },
    creates: () => requests.filter((request) => request.method === "POST").length,
    reads: () => requests.filter((request) => request.method === "GET").length,
  };
}

function sign(fields: Record<string, string>, key: string, prefix = ""): string {
  const source = Object.entries(fields)
    .map(([name, value]) => `${prefix}${name}${value}`)
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0))
    .join("|");
  return createHmac("sha256", key).update(source).digest("hex");
}

/** What Billplz POSTs to the callback URL, signed with `key`. `extra` fields are signed too. */
function callbackBody(bill: Doc, extra: Record<string, string> = {}, key = SIGNING_KEY): URLSearchParams {
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
    ...extra,
  };
  const body = new URLSearchParams(fields);
  body.set("x_signature", sign(fields, key));
  return body;
}

function returnQuery(bill: Doc, key = SIGNING_KEY): string {
  const fields = { id: String(bill.id), paid: String(bill.paid), paid_at: bill.paid_at ? String(bill.paid_at) : "" };
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(fields)) query.set(`billplz[${name}]`, value);
  query.set("billplz[x_signature]", sign(fields, key, "billplz"));
  return query.toString();
}

async function call(handler: Handler, path: string, init: RequestInit) {
  const response = await handler(new Request(`https://webbi.my${path}`, { method: "POST", ...init }));
  return { status: response.status, body: (await response.json()) as Doc };
}

function send(user: VerifiedUser, handler: Handler, path: string, body: unknown) {
  vi.mocked(requireUser).mockResolvedValue(user);
  return call(handler, path, {
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const postCallback = (body: URLSearchParams) =>
  call(callback, "/api/payments/webhook", {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

const pressPay = (user: VerifiedUser, siteId: string, body: Doc = {}) =>
  send(user, checkout, "/api/publish/checkout", { siteId, slug: SLUG, ...body });

const returnTo = (user: VerifiedUser, siteId: string, bill: Doc) =>
  send(user, confirm, "/api/publish/confirm", { siteId, sessionId: bill.id, redirectQuery: returnQuery(bill) });

const deleteSite = (user: VerifiedUser, siteId: string) => send(user, removeRoute, "/api/sites/delete", { siteId });

async function openBill(user: VerifiedUser, siteId: string, body: Doc = {}) {
  const res = await pressPay(user, siteId, body);
  expect(res.status).toBe(200);
  const billId = String(res.body.url).split("/").pop() ?? "";
  const bill = billplz.bills.get(billId);
  if (!bill) throw new Error("checkout didn't open a bill");
  return { bill, billId, paymentId: String(bill.reference_1) };
}

/** A draft with an open bill that the customer has paid on Billplz; Webbi hasn't heard yet. */
async function paidOnBillplz(siteId = "site-a", amount?: number, slug = SLUG) {
  const owner = person();
  seedSite(siteId, owner.uid);
  const opened = await openBill(owner, siteId, { slug });
  billplz.pay(opened.billId, amount);
  return { owner, siteId, ...opened };
}

/** A second bill for the same site, as two tabs opening checkout at the same moment would leave. */
function secondBill(first: { bill: Doc; paymentId: string }, billId = "bill0900", paymentId = "payment-tab-2") {
  const bill = { ...first.bill, id: billId, reference_1: paymentId, url: `https://www.billplz.com/bills/${billId}` };
  billplz.bills.set(billId, bill);
  db.seed(`payments/${paymentId}`, { ...payment(first.paymentId), status: "pending", providerRef: billId });
  return { bill, billId, paymentId };
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
  billplz = fakeBillplzApi();
  vi.mocked(revalidateTag).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("checkout", () => {
  it("1. opens a 14990 sen bill for the owner's own draft", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const { bill, billId, paymentId } = await openBill(owner, "site-a");
    expect(bill).toMatchObject({ amount: 14990, collection_id: COLLECTION, reference_1: paymentId, reference_2: "site-a" });
    expect(payment(paymentId)).toMatchObject({
      siteId: "site-a",
      ownerUid: owner.uid,
      amountSen: 14990,
      currency: "myr",
      providerRef: billId,
      checkoutUrl: `https://www.billplz.com/bills/${billId}`,
      status: "pending",
    });
    expect(site("site-a")).toMatchObject({ status: "draft", paid: false });
  });

  it("2. refuses a request without a signed-in user", async () => {
    seedSite("site-a", "someone");
    vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());
    const res = await call(checkout, "/api/publish/checkout", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ siteId: "site-a", slug: SLUG }),
    });
    expect(res.status).toBe(401);
    expect(billplz.creates()).toBe(0);
    expect(db.ids("payments")).toEqual([]);
  });

  it("3. refuses another user's website", async () => {
    seedSite("site-a", person().uid);
    expect((await pressPay(person(), "site-a")).status).toBe(404);
    expect(billplz.creates()).toBe(0);
    expect(db.ids("payments")).toEqual([]);
  });

  it("4. charges 14990 sen whatever amount the browser sends (1, 100, 14990, 999999)", async () => {
    for (const amount of [1, 100, 14990, 999999]) {
      const owner = person();
      const siteId = `site-${amount}`;
      seedSite(siteId, owner.uid);
      const { bill, paymentId } = await openBill(owner, siteId, {
        amount,
        amountSen: amount,
        price: amount,
        currency: "usd",
      });
      expect(bill.amount).toBe(14990);
      expect(payment(paymentId)).toMatchObject({ amountSen: 14990, currency: "myr" });
    }
  });

  it("5. records the signed-in user as the owner, whatever owner, site or state the browser names", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const { paymentId } = await openBill(owner, "site-a", {
      uid: "attacker",
      ownerUid: "attacker",
      paymentId: "chosen-id",
      providerRef: "bill-chosen",
      status: "paid",
      paid: true,
    });
    expect(paymentId).not.toBe("chosen-id");
    expect(payment(paymentId)).toMatchObject({ ownerUid: owner.uid, siteId: "site-a", status: "pending" });
    expect(payment(paymentId).providerRef).not.toBe("bill-chosen");
  });

  it("6. reuses the site's open bill instead of opening another", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const first = await openBill(owner, "site-a");
    const again = await pressPay(owner, "site-a");
    expect(again).toEqual({ status: 200, body: { url: first.bill.url } });
    expect(billplz.creates()).toBe(1);
    expect(billplz.reads()).toBe(1); // checked with Billplz that it's still open
    expect(db.ids("payments")).toEqual([first.paymentId]);
  });

  it("7. opens a new bill when the old one was deleted or can't be found, keeping the old record unpaid", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const deleted = await openBill(owner, "site-a");
    deleted.bill.state = "deleted";
    const replacement = await openBill(owner, "site-a");
    expect(replacement.billId).not.toBe(deleted.billId);
    expect(payment(deleted.paymentId)).toMatchObject({ status: "failed", failureReason: "bill_deleted", providerRef: deleted.billId });

    billplz.bills.delete(replacement.billId); // Billplz no longer knows it
    const third = await openBill(owner, "site-a");
    expect(third.billId).not.toBe(replacement.billId);
    expect(payment(replacement.paymentId)).toMatchObject({ status: "pending", providerRef: replacement.billId });
    expect(db.ids("payments")).toHaveLength(3);
    expect(site("site-a")).toMatchObject({ status: "draft", paid: false });
  });
});

describe("callback", () => {
  it("8. accepts a correctly signed callback", async () => {
    const paid = await paidOnBillplz();
    expect(await postCallback(callbackBody(paid.bill))).toEqual({
      status: 200,
      body: { received: true, slug: SLUG, published: true },
    });
  });

  it("9. rejects an invalid signature, or a signed callback edited afterwards, and changes nothing", async () => {
    const paid = await paidOnBillplz();
    const edits: Array<[string, string]> = [
      ["amount", "100"],
      ["paid_amount", "999999"],
      ["id", "bill0999"],
      ["collection_id", "someone_elses_col"],
      ["reference_1", "another-payment"],
      ["reference_2", "another-site"],
    ];
    const bodies = [callbackBody(paid.bill, {}, "someone-elses-key")];
    for (const [field, value] of edits) {
      const body = callbackBody(paid.bill);
      body.set(field, value);
      bodies.push(body);
    }
    for (const body of bodies) {
      expect(await postCallback(body)).toEqual({ status: 400, body: { error: { code: "bad_request", message: "Invalid signature." } } });
    }
    expect(payment(paid.paymentId)).toMatchObject({ status: "pending" });
    expect(site("site-a")).toMatchObject({ status: "draft", paid: false });
    expect(db.ids("publicSites")).toEqual([]);
  });

  it("10. rejects a callback with no signature", async () => {
    const paid = await paidOnBillplz();
    const body = callbackBody(paid.bill);
    body.delete("x_signature");
    expect((await postCallback(body)).status).toBe(400);
    body.set("x_signature", "");
    expect((await postCallback(body)).status).toBe(400);
    expect(payment(paid.paymentId)).toMatchObject({ status: "pending" });
    expect(db.ids("publicSites")).toEqual([]);
  });

  it("11. ignores a signed bill from another collection", async () => {
    const paid = await paidOnBillplz();
    const foreign = { ...paid.bill, collection_id: "someone_elses_col" };
    expect(await postCallback(callbackBody(foreign))).toEqual({ status: 200, body: { received: true, ignored: true } });
    expect(payment(paid.paymentId)).toMatchObject({ status: "pending" });
    expect(db.ids("publicSites")).toEqual([]);
  });

  it("12. doesn't publish a wrong amount; keeps it paid and flagged for a refund", async () => {
    const paid = await paidOnBillplz("site-a", 100);
    expect((await postCallback(callbackBody(paid.bill))).body).toEqual({
      received: true,
      slug: null,
      published: false,
      needsAttention: true,
    });
    expect(payment(paid.paymentId)).toMatchObject({
      status: "paid",
      paidAmountSen: 100,
      needsAttention: true,
      attentionReason: "amount_mismatch",
    });
    expect(site("site-a")).toMatchObject({ status: "draft", paid: false });
    expect(db.ids("publicSites")).toEqual([]);
  });

  it("13. refuses a bill that doesn't map to its payment record or site, and records nothing", async () => {
    const paid = await paidOnBillplz();
    seedSite("site-b", paid.owner.uid);
    const cases: Array<[Doc, Record<string, string>, string]> = [
      [{ ...paid.bill, id: "bill9999", url: "https://www.billplz.com/bills/bill9999" }, {}, "not_found"],
      [paid.bill, { reference_2: "site-b" }, "forbidden"],
      [{ ...paid.bill, id: "bill9998" }, { reference_1: paid.paymentId }, "forbidden"],
    ];
    for (const [bill, extra, refused] of cases) {
      expect(await postCallback(callbackBody(bill, extra))).toEqual({ status: 200, body: { received: true, refused } });
    }
    expect(payment(paid.paymentId)).toMatchObject({ status: "pending", providerRef: paid.billId });
    expect(site("site-a")).toMatchObject({ status: "draft" });
    expect(site("site-b")).toMatchObject({ status: "draft" });
    expect(db.ids("publicSites")).toEqual([]);
  });

  it("14. marks the payment paid, with its Billplz reference, amount and time", async () => {
    const paid = await paidOnBillplz();
    await postCallback(callbackBody(paid.bill));
    const record = payment(paid.paymentId);
    expect(record).toMatchObject({
      status: "paid",
      providerRef: paid.billId,
      paidAmountSen: 14990,
      amountSen: 14990,
      failureReason: null,
      needsAttention: false,
      attentionReason: null,
    });
    expect((record.paidAt as { toDate(): Date }).toDate()).toEqual(new Date("2026-09-13T02:15:09.000Z"));
    expect(record.fulfilledAt).toBeTruthy();
  });

  it("15. publishes the website and records which payment did", async () => {
    const paid = await paidOnBillplz();
    await postCallback(callbackBody(paid.bill));
    expect(site("site-a")).toMatchObject({ status: "published", paid: true, slug: SLUG, paymentId: paid.paymentId });
    expect(db.read(`publicSites/${SLUG}`)).toMatchObject({ siteId: "site-a", slug: SLUG });
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith(`site:${SLUG}`, { expire: 0 });
  });

  it("16. treats a repeated callback as already done", async () => {
    const paid = await paidOnBillplz();
    const results = [];
    for (let i = 0; i < 3; i++) results.push((await postCallback(callbackBody(paid.bill))).body);
    expect(results.map((body) => body.published)).toEqual([true, false, false]);
    expect(results.every((body) => body.slug === SLUG)).toBe(true);
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(1);
  });

  it("17. never creates a second public site or link for one website", async () => {
    const paid = await paidOnBillplz();
    await postCallback(callbackBody(paid.bill));
    await returnTo(paid.owner, "site-a", paid.bill);
    await postCallback(callbackBody(paid.bill));
    expect(db.ids("publicSites")).toEqual([SLUG]);
    expect(db.ids("slugs")).toEqual([SLUG]);
  });
});

describe("return page", () => {
  it("18. asks Billplz for the bill before publishing", async () => {
    const paid = await paidOnBillplz();
    const readsBefore = billplz.reads();
    expect(await returnTo(paid.owner, "site-a", paid.bill)).toEqual({ status: 200, body: { status: "published", slug: SLUG } });
    expect(billplz.reads()).toBe(readsBefore + 1);
    expect(payment(paid.paymentId)).toMatchObject({ status: "paid", needsAttention: false });
  });

  it("19. can't fake paid: a signed paid=true for a due bill, or an unsigned one, publishes nothing", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const { bill, paymentId } = await openBill(owner, "site-a");
    const claim = { ...bill, paid: true, paid_at: PAID_AT };
    expect(await returnTo(owner, "site-a", claim)).toEqual({ status: 200, body: { status: "pending" } });
    const unsigned = await send(owner, confirm, "/api/publish/confirm", {
      siteId: "site-a",
      sessionId: bill.id,
      redirectQuery: "billplz%5Bid%5D=" + bill.id + "&billplz%5Bpaid%5D=true&paid=true",
      paid: true,
      status: "paid",
    });
    expect(unsigned).toEqual({ status: 200, body: { status: "pending" } });
    expect(payment(paymentId)).toMatchObject({ status: "pending" });
    expect(site("site-a")).toMatchObject({ status: "draft", paid: false });
    expect(db.ids("publicSites")).toEqual([]);
  });
});

describe("ordering", () => {
  it("20. callback then return: published once, the return page shows it live", async () => {
    const paid = await paidOnBillplz();
    expect((await postCallback(callbackBody(paid.bill))).body.published).toBe(true);
    expect(await returnTo(paid.owner, "site-a", paid.bill)).toEqual({ status: 200, body: { status: "published", slug: SLUG } });
    expect(db.ids("publicSites")).toEqual([SLUG]);
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(1);
  });

  it("21. return then callback: published once, the callback changes nothing", async () => {
    const paid = await paidOnBillplz();
    expect((await returnTo(paid.owner, "site-a", paid.bill)).body).toEqual({ status: "published", slug: SLUG });
    expect((await postCallback(callbackBody(paid.bill))).body).toEqual({ received: true, slug: SLUG, published: false });
    expect(db.ids("publicSites")).toEqual([SLUG]);
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(1);
  });

  it("22. callback and return at the same moment: published once", async () => {
    const paid = await paidOnBillplz();
    const [fromCallback, fromReturn] = await Promise.all([
      postCallback(callbackBody(paid.bill)),
      returnTo(paid.owner, "site-a", paid.bill),
    ]);
    expect(fromCallback.status).toBe(200);
    expect(fromReturn.body).toEqual({ status: "published", slug: SLUG });
    expect(db.ids("publicSites")).toEqual([SLUG]);
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(1);
    expect(payment(paid.paymentId)).toMatchObject({ status: "paid", needsAttention: false });
  });

  it("23. many fulfilments at once publish exactly once", async () => {
    const paid = await paidOnBillplz();
    const results = await Promise.all([
      postCallback(callbackBody(paid.bill)),
      postCallback(callbackBody(paid.bill)),
      returnTo(paid.owner, "site-a", paid.bill),
      postCallback(callbackBody(paid.bill)),
      returnTo(paid.owner, "site-a", paid.bill),
    ]);
    expect(results.every((res) => res.status === 200)).toBe(true);
    expect(results.filter((res) => res.body.published === true)).toHaveLength(1);
    expect(db.ids("publicSites")).toEqual([SLUG]);
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(1);
    expect(db.conflicts).toBeGreaterThan(0); // the transactions really did collide
  });
});

describe("paid but not published", () => {
  it("24. a broken draft or a Firestore outage keeps the payment paid, never failed", async () => {
    const broken = await paidOnBillplz("site-a");
    db.patch("sites/site-a", { draft: { nonsense: true } });
    expect((await postCallback(callbackBody(broken.bill))).body).toMatchObject({ published: false, needsAttention: true });
    expect(payment(broken.paymentId)).toMatchObject({
      status: "paid",
      providerRef: broken.billId,
      needsAttention: true,
      attentionReason: "invalid_draft",
      failureReason: null,
    });
    const told = await returnTo(broken.owner, "site-a", broken.bill);
    expect(told.status).toBe(409);
    expect(String((told.body.error as Doc).message)).toContain("We've received your payment");

    const outage = await paidOnBillplz("site-b");
    const realTransaction = db.runTransaction.bind(db);
    let transactions = 0;
    vi.spyOn(db, "runTransaction").mockImplementation(((fn: Parameters<typeof realTransaction>[0]) =>
      ++transactions === 2 ? Promise.reject(new Error("UNAVAILABLE")) : realTransaction(fn)) as typeof db.runTransaction);
    expect((await postCallback(callbackBody(outage.bill))).status).toBe(500); // Billplz will call again
    expect(payment(outage.paymentId)).toMatchObject({
      status: "paid",
      needsAttention: true,
      attentionReason: "fulfilment_error",
    });
    expect(site("site-b")).toMatchObject({ status: "draft" });
    // …and when it does, the website goes live.
    expect((await postCallback(callbackBody(outage.bill))).body).toEqual({ received: true, slug: SLUG, published: true });
    expect(payment(outage.paymentId)).toMatchObject({ status: "paid", needsAttention: false, attentionReason: null });
  });

  it("25. can be retried once fixed: pressing Pay again publishes without a new bill", async () => {
    const paid = await paidOnBillplz();
    db.patch("sites/site-a", { draft: { nonsense: true } });
    await postCallback(callbackBody(paid.bill));
    expect((await pressPay(paid.owner, "site-a")).status).toBe(400); // the draft still needs fixing

    db.patch("sites/site-a", { draft: structuredClone(DRAFT) });
    expect(await pressPay(paid.owner, "site-a")).toEqual({ status: 200, body: { url: "/s/site-a/live" } });
    expect(billplz.creates()).toBe(1);
    expect(site("site-a")).toMatchObject({ status: "published", slug: SLUG, paymentId: paid.paymentId });
    expect(payment(paid.paymentId)).toMatchObject({ status: "paid", needsAttention: false });
  });

  it("26. the server-side retry publishes once, and refuses anything unpaid", async () => {
    const paid = await paidOnBillplz();
    db.patch("sites/site-a", { draft: { nonsense: true } });
    await postCallback(callbackBody(paid.bill));
    db.patch("sites/site-a", { draft: structuredClone(DRAFT) });

    const results = await Promise.all([1, 2, 3].map(() => retryPaymentFulfilment(paid.paymentId)));
    expect(results.filter((result) => result.published)).toHaveLength(1);
    expect(results.every((result) => result.slug === SLUG)).toBe(true);
    expect((await retryPaymentFulfilment(paid.paymentId)).published).toBe(false);
    expect(db.ids("publicSites")).toEqual([SLUG]);

    const unpaid = person();
    seedSite("site-u", unpaid.uid);
    const open = await openBill(unpaid, "site-u", { slug: "kedai-u" });
    await expect(retryPaymentFulfilment(open.paymentId)).rejects.toMatchObject({ code: "conflict" });
    await expect(retryPaymentFulfilment("../../sites/site-u")).rejects.toBeInstanceOf(PublishError);
    await expect(retryPaymentFulfilment("no-such-payment")).rejects.toMatchObject({ code: "not_found" });
    expect(site("site-u")).toMatchObject({ status: "draft" });
  });

  it("27. a taken link falls back to the next free one, and never overwrites another site", async () => {
    const other = { siteId: "other-site", ownerUid: "other-owner" };
    const paid = await paidOnBillplz();
    // Another website takes the link while this customer is on Billplz.
    db.seed(`slugs/${SLUG}`, other);
    db.seed(`publicSites/${SLUG}`, { siteId: "other-site", slug: SLUG, content: { mine: false } });
    expect((await postCallback(callbackBody(paid.bill))).body).toEqual({ received: true, slug: `${SLUG}-2`, published: true });
    expect(db.read(`publicSites/${SLUG}`)).toEqual({ siteId: "other-site", slug: SLUG, content: { mine: false } });
    expect(db.read(`slugs/${SLUG}`)).toEqual(other);

    // The link and every fallback taken while the customer was paying: paid and flagged,
    // nothing overwritten, and choosing a new link publishes it.
    const crowded = await paidOnBillplz("site-c", undefined, "kedai-c");
    for (const slug of ["kedai-c", "kedai-c-2", "kedai-c-3", "kedai-c-4", "kedai-c-5", "kedai-c-6"]) db.seed(`slugs/${slug}`, other);
    expect((await postCallback(callbackBody(crowded.bill))).body).toMatchObject({ published: false, needsAttention: true });
    expect(payment(crowded.paymentId)).toMatchObject({ status: "paid", attentionReason: "slug_unavailable" });
    expect(db.read("slugs/kedai-c-6")).toEqual(other);
    expect(await pressPay(crowded.owner, "site-c", { slug: "kedai-baharu" })).toEqual({ status: 200, body: { url: "/s/site-c/live" } });
    expect(site("site-c")).toMatchObject({ status: "published", slug: "kedai-baharu" });
    expect(billplz.creates()).toBe(2);
  });
});

describe("deleting", () => {
  it("28. a paid website can't be deleted; an open bill is checked with Billplz first", async () => {
    // Paid but not yet live: refused with a clear reason.
    const stuck = await paidOnBillplz("site-a");
    db.patch("sites/site-a", { draft: { nonsense: true } });
    await postCallback(callbackBody(stuck.bill));
    const refused = await deleteSite(stuck.owner, "site-a");
    expect(refused.status).toBe(409);
    expect(String((refused.body.error as Doc).message)).toContain("received a payment");
    expect(site("site-a")).toMatchObject({ status: "draft" });

    // Paid on Billplz a moment ago, callback not here yet: published instead of deleted.
    const racing = await paidOnBillplz("site-b");
    expect((await deleteSite(racing.owner, "site-b")).status).toBe(409);
    expect(site("site-b")).toMatchObject({ status: "published", slug: SLUG });

    // Billplz unreachable: not deleted.
    const unreachable = person();
    seedSite("site-c", unreachable.uid);
    await openBill(unreachable, "site-c", { slug: "kedai-c" });
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    expect((await deleteSite(unreachable, "site-c")).status).toBe(409);
    expect(site("site-c")).toMatchObject({ status: "draft" });

    // A bill still due: the draft is deleted and the bill's record closed, never paid.
    const owner = person();
    seedSite("site-d", owner.uid);
    const open = await openBill(owner, "site-d", { slug: "kedai-d" });
    expect(await deleteSite(owner, "site-d")).toEqual({ status: 200, body: { deleted: true } });
    expect(db.read("sites/site-d")).toBeUndefined();
    expect(payment(open.paymentId)).toMatchObject({ status: "failed", failureReason: "site_deleted" });
    expect(lock(owner.uid)).toBeNull();

    // If that bill is paid anyway, it's kept as paid for a refund; nothing is published.
    billplz.pay(open.billId);
    expect((await postCallback(callbackBody(open.bill))).body).toMatchObject({ published: false, needsAttention: true });
    expect(payment(open.paymentId)).toMatchObject({ status: "paid", attentionReason: "site_missing" });
    expect(db.ids("publicSites")).toEqual([SLUG]);
  });
});

describe("unpaid bills", () => {
  it("29. a failed bill publishes nothing", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const { bill, paymentId } = await openBill(owner, "site-a");
    bill.state = "deleted";
    expect((await postCallback(callbackBody(bill))).body).toEqual({ received: true, failed: true });
    expect((await returnTo(owner, "site-a", bill)).body).toEqual({ status: "failed", reason: "bill_deleted" });
    expect(payment(paymentId)).toMatchObject({ status: "failed" });
    expect(site("site-a")).toMatchObject({ status: "draft", paid: false });
    expect(db.ids("publicSites")).toEqual([]);
    expect(lock(owner.uid)).toBe("site-a");
  });

  it("30. a pending bill publishes nothing", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const { bill, paymentId } = await openBill(owner, "site-a");
    expect((await postCallback(callbackBody(bill))).body).toEqual({ received: true, pending: true });
    expect((await returnTo(owner, "site-a", bill)).body).toEqual({ status: "failed", reason: "not_paid" });
    await expect(retryPaymentFulfilment(paymentId)).rejects.toMatchObject({ code: "conflict" });
    expect(payment(paymentId)).toMatchObject({ status: "pending" });
    expect(site("site-a")).toMatchObject({ status: "draft", paid: false });
    expect(db.ids("publicSites")).toEqual([]);
  });
});

describe("duplicates, records and the draft slot", () => {
  it("31. a second paid bill is recorded as a duplicate with what's needed to refund it", async () => {
    const first = await paidOnBillplz();
    const second = secondBill(first);
    billplz.pay(second.billId);

    const [a, b] = await Promise.all([postCallback(callbackBody(first.bill)), postCallback(callbackBody(second.bill))]);
    expect([a.body.published, b.body.published].filter(Boolean)).toHaveLength(1);
    const winner = site("site-a").paymentId;
    const loser = winner === first.paymentId ? second : first;
    expect(payment(loser.paymentId)).toMatchObject({
      status: "paid",
      duplicate: true,
      needsAttention: true,
      attentionReason: "duplicate",
      providerRef: loser.billId,
      siteId: "site-a",
      ownerUid: first.owner.uid,
      paidAmountSen: 14990,
    });
    expect(db.ids("publicSites")).toEqual([SLUG]);
    const logged = vi.mocked(console.error).mock.calls.map((args) => String(args[0]));
    expect(logged.some((message) => message.includes("refund"))).toBe(true);
    // The return page for the duplicate shows the live website; it isn't charged or published again.
    expect((await returnTo(first.owner, "site-a", loser.bill)).body).toEqual({ status: "published", slug: SLUG });
    expect(await pressPay(first.owner, "site-a")).toMatchObject({ status: 409 });
    expect(billplz.creates()).toBe(1);
  });

  it("32. records, responses and logs hold no secrets", async () => {
    const paid = await paidOnBillplz();
    const signature = callbackBody(paid.bill).get("x_signature") ?? "";
    const responses = [
      await postCallback(callbackBody(paid.bill)),
      await returnTo(paid.owner, "site-a", paid.bill),
      await pressPay(paid.owner, "site-a"),
    ];
    const stored = ["payments", "sites", "publicSites", "slugs", "userQuotas"].flatMap((name) =>
      db.list(name).map((snap) => snap.data()),
    );
    const logs = [...vi.mocked(console.error).mock.calls, ...vi.mocked(console.warn).mock.calls];
    const everything = JSON.stringify([stored, responses, logs]);
    for (const secret of [SECRET, SIGNING_KEY, signature]) expect(everything).not.toContain(secret);
    expect(Object.keys(payment(paid.paymentId)).sort()).toEqual(
      [
        "amountSen",
        "attentionReason",
        "checkoutUrl",
        "createdAt",
        "currency",
        "failureReason",
        "fulfilledAt",
        "needsAttention",
        "ownerUid",
        "paidAmountSen",
        "paidAt",
        "provider",
        "providerRef",
        "siteId",
        "slug",
        "status",
        "updatedAt",
      ].sort(),
    );
    // The return page learns only the outcome, not the payment record.
    expect(responses[1].body).toEqual({ status: "published", slug: SLUG });
  });

  it("33. fulfilling a published payment again writes nothing", async () => {
    const paid = await paidOnBillplz();
    await postCallback(callbackBody(paid.bill));
    const before = JSON.stringify(["payments", "sites", "publicSites", "slugs", "userQuotas"].map((name) => db.list(name).map((snap) => [snap.id, snap.data()])));
    await postCallback(callbackBody(paid.bill));
    await returnTo(paid.owner, "site-a", paid.bill);
    await retryPaymentFulfilment(paid.paymentId);
    await pressPay(paid.owner, "site-a");
    const after = JSON.stringify(["payments", "sites", "publicSites", "slugs", "userQuotas"].map((name) => db.list(name).map((snap) => [snap.id, snap.data()])));
    expect(after).toBe(before);
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(1);
  });

  it("34. the draft slot is released only once the website is live, and only for that website", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const { bill, billId } = await openBill(owner, "site-a");
    expect(lock(owner.uid)).toBe("site-a");
    await postCallback(callbackBody(bill)); // still due
    expect(lock(owner.uid)).toBe("site-a");
    billplz.pay(billId);
    await postCallback(callbackBody(bill));
    expect(site("site-a")).toMatchObject({ status: "published" });
    expect(lock(owner.uid)).toBeNull();

    // A second website's slot is untouched by a late duplicate for the first.
    db.patch(`userQuotas/${owner.uid}`, { openDraftSiteId: "site-b" });
    const dup = secondBill({ bill, paymentId: String(bill.reference_1) });
    billplz.pay(dup.billId);
    await postCallback(callbackBody(dup.bill));
    expect(lock(owner.uid)).toBe("site-b");
  });

  it("35. a failed publication keeps the slot until a retry publishes", async () => {
    const paid = await paidOnBillplz();
    db.patch("sites/site-a", { draft: { nonsense: true } });
    await postCallback(callbackBody(paid.bill));
    expect(payment(paid.paymentId)).toMatchObject({ status: "paid", needsAttention: true });
    expect(lock(paid.owner.uid)).toBe("site-a");

    db.patch("sites/site-a", { draft: structuredClone(DRAFT) });
    expect((await retryPaymentFulfilment(paid.paymentId)).published).toBe(true);
    expect(lock(paid.owner.uid)).toBeNull();
  });
});
