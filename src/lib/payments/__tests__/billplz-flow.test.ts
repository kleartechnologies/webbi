import { createHmac } from "node:crypto";
import { revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as callback } from "@/app/api/payments/webhook/route";
import { POST as checkout } from "@/app/api/publish/checkout/route";
import { POST as confirm } from "@/app/api/publish/confirm/route";
import { POST as republish } from "@/app/api/publish/republish/route";
import { requireUser, type VerifiedUser } from "@/lib/auth/verify";
import { DEMO_SITES } from "@/lib/site/demo";
import { FakeFirestore } from "@/test/fakeFirestore";

/**
 * The whole Billplz path through Webbi's real route handlers and publish code:
 * checkout → Billplz (faked at fetch) → callback / return → Firestore (faked
 * in memory). Signing uses made-up keys that exist only in this file.
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

type Doc = Record<string, unknown>;
type Handler = (request: Request) => Promise<Response>;

let db: FakeFirestore;
let billplz: ReturnType<typeof fakeBillplzApi>;
let people = 0;

/** A signed-in account. Every test gets fresh ones, so the per-user rate limits never carry over. */
function person(overrides: Partial<VerifiedUser> = {}): VerifiedUser {
  people += 1;
  return { uid: `owner-${people}`, isAnonymous: false, email: `owner${people}@example.com`, name: "Aisyah", ...overrides };
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
}

const site = (id: string): Doc => db.read(`sites/${id}`) ?? {};
const payment = (id: string): Doc => db.read(`payments/${id}`) ?? {};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Stands in for the Billplz production API: bills are created, read back and paid here. */
function fakeBillplzApi() {
  const bills = new Map<string, Doc>();
  const requests: Array<{ method: string; url: string; body: URLSearchParams | null }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = String(input);
      const method = init.method ?? "GET";
      const body = typeof init.body === "string" ? new URLSearchParams(init.body) : null;
      requests.push({ method, url, body });
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
  return {
    bills,
    requests,
    /** The customer pays the bill on Billplz. */
    pay(id: string, amount?: number) {
      const bill = bills.get(id);
      if (!bill) throw new Error(`no bill ${id}`);
      Object.assign(bill, { paid: true, state: "paid", paid_amount: amount ?? bill.amount, paid_at: PAID_AT });
    },
    reads: () => requests.filter((request) => request.method === "GET").length,
  };
}

/** Billplz's recipe: key+value, sorted case-insensitively, joined with "|", HMAC-SHA256. */
function sign(fields: Record<string, string>, key: string, prefix = ""): string {
  const source = Object.entries(fields)
    .map(([name, value]) => `${prefix}${name}${value}`)
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0))
    .join("|");
  return createHmac("sha256", key).update(source).digest("hex");
}

/** What Billplz POSTs to the callback URL for a bill, signed with `key`. */
function callbackBody(bill: Doc, key = SIGNING_KEY): URLSearchParams {
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
  const body = new URLSearchParams(fields);
  body.set("x_signature", sign(fields, key));
  return body;
}

/** The query Billplz adds when it sends the customer back, signed with `key`. */
function returnQuery(bill: Doc, key = SIGNING_KEY): URLSearchParams {
  const fields = { id: String(bill.id), paid: String(bill.paid), paid_at: bill.paid_at ? String(bill.paid_at) : "" };
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(fields)) query.set(`billplz[${name}]`, value);
  query.set("billplz[x_signature]", sign(fields, key, "billplz"));
  return query;
}

async function call(handler: Handler, path: string, init: RequestInit) {
  const response = await handler(new Request(`https://webbi.my${path}`, { method: "POST", ...init }));
  return { status: response.status, body: (await response.json()) as Doc };
}

/** A request from `user` to one of Webbi's signed-in API routes. */
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

const confirmAs = (user: VerifiedUser, body: Doc) => send(user, confirm, "/api/publish/confirm", body);

/** Starts checkout the way the Publish screen does; returns the bill Billplz opened and our payment id. */
async function openBill(user: VerifiedUser, siteId: string, slug: string) {
  const res = await send(user, checkout, "/api/publish/checkout", { siteId, slug });
  expect(res.status).toBe(200);
  const billId = String(res.body.url).split("/").pop() ?? "";
  const bill = billplz.bills.get(billId);
  if (!bill) throw new Error("checkout didn't open a bill");
  return { bill, billId, paymentId: String(bill.reference_1) };
}

beforeEach(() => {
  // As on Netlify: PAYMENT_PROVIDER unset, so Billplz is chosen because its three keys are present.
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

describe("checkout: the bill is created on the server", () => {
  it("charges 14990 sen for this user's website, whatever the browser sends", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const res = await send(owner, checkout, "/api/publish/checkout", {
      siteId: "site-a",
      slug: "Kedai-Aisyah-A",
      // None of these are read: price, currency, owner and status all come from the server.
      amount: 1,
      amountSen: 1,
      currency: "usd",
      uid: "someone-else",
      paid: true,
      status: "paid",
    });

    expect(res.status).toBe(200);
    const billId = String(res.body.url).split("/").pop();
    expect(res.body.url).toBe(`https://www.billplz.com/bills/${billId}`);
    expect(billplz.requests).toHaveLength(1);
    const [create] = billplz.requests;
    expect(create.method).toBe("POST");
    expect(create.url).toBe("https://www.billplz.com/api/v3/bills");

    expect(db.ids("payments")).toHaveLength(1);
    const [paymentId] = db.ids("payments");
    expect(Object.fromEntries(create.body ?? [])).toMatchObject({
      collection_id: COLLECTION,
      amount: "14990",
      email: owner.email,
      name: "Aisyah",
      callback_url: "https://webbi.my/api/payments/webhook",
      redirect_url: "https://webbi.my/s/site-a/publish/return",
      reference_1: paymentId,
      reference_2: "site-a",
    });
    expect(payment(paymentId)).toMatchObject({
      siteId: "site-a",
      ownerUid: owner.uid,
      slug: "kedai-aisyah-a",
      amountSen: 14990,
      currency: "myr",
      provider: "billplz",
      providerRef: billId,
      status: "pending",
    });
    // Opening a bill publishes nothing.
    expect(site("site-a")).toMatchObject({ status: "draft", paid: false, slug: null });
    expect(db.ids("publicSites")).toEqual([]);
    expect(db.ids("slugs")).toEqual([]);
  });

  it("refuses guests, other people's websites and live websites without opening a bill", async () => {
    const owner = person();
    seedSite("site-b", owner.uid);
    seedSite("site-live", owner.uid, { status: "published", paid: true, slug: "already-live" });

    const guest = person({ isAnonymous: true, email: undefined });
    expect((await send(guest, checkout, "/api/publish/checkout", { siteId: "site-b", slug: "kedai-b" })).status).toBe(403);
    expect((await send(person(), checkout, "/api/publish/checkout", { siteId: "site-b", slug: "kedai-b" })).status).toBe(404);
    expect((await send(owner, checkout, "/api/publish/checkout", { siteId: "site-live", slug: "kedai-c" })).status).toBe(409);
    expect(billplz.requests).toHaveLength(0);
    expect(db.ids("payments")).toEqual([]);
  });
});

describe("callback: the signed callback is what publishes", () => {
  it("publishes exactly the website the paid bill was opened for", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    seedSite("site-b", owner.uid);
    const a = await openBill(owner, "site-a", "kedai-aisyah-a");
    const b = await openBill(owner, "site-b", "kedai-aisyah-b");

    billplz.pay(a.billId);
    expect(await postCallback(callbackBody(a.bill))).toEqual({
      status: 200,
      body: { received: true, slug: "kedai-aisyah-a", published: true },
    });

    expect(site("site-a")).toMatchObject({ status: "published", paid: true, slug: "kedai-aisyah-a" });
    expect(site("site-a").published).toBeTruthy();
    expect(db.read("publicSites/kedai-aisyah-a")).toMatchObject({
      siteId: "site-a",
      slug: "kedai-aisyah-a",
      content: site("site-a").published,
    });
    expect(db.read("slugs/kedai-aisyah-a")).toMatchObject({ siteId: "site-a", ownerUid: owner.uid });
    expect(payment(a.paymentId)).toMatchObject({ status: "paid", providerRef: a.billId, failureReason: null });
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith("site:kedai-aisyah-a", { expire: 0 });
    // The callback is verified by its signature alone.
    expect(billplz.reads()).toBe(0);

    // The other draft, with its own unpaid bill, is untouched.
    expect(site("site-b")).toMatchObject({ status: "draft", paid: false, slug: null });
    expect(payment(b.paymentId)).toMatchObject({ status: "pending", providerRef: b.billId });
    expect(db.ids("publicSites")).toEqual(["kedai-aisyah-a"]);
  });

  it("rejects a forged, unsigned or edited callback and changes nothing", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const a = await openBill(owner, "site-a", "kedai-aisyah-a");
    const claimsPaid = { ...a.bill, paid: true, state: "paid", paid_amount: 14990, paid_at: PAID_AT };

    const forged = callbackBody(claimsPaid, "someone-elses-key");
    const unsigned = callbackBody(claimsPaid);
    unsigned.delete("x_signature");
    const edited = callbackBody(a.bill); // genuinely signed while the bill was still due…
    edited.set("paid", "true"); // …then changed on the way in
    edited.set("state", "paid");
    edited.set("paid_amount", "14990");

    for (const body of [forged, unsigned, edited]) {
      expect(await postCallback(body)).toEqual({
        status: 400,
        body: { error: { code: "bad_request", message: "Invalid signature." } },
      });
    }
    expect(site("site-a")).toMatchObject({ status: "draft", paid: false, slug: null });
    expect(payment(a.paymentId)).toMatchObject({ status: "pending" });
    expect(db.ids("publicSites")).toEqual([]);
  });

  it("leaves a due bill unpublished and records a deleted bill as failed", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const a = await openBill(owner, "site-a", "kedai-aisyah-a");

    expect(await postCallback(callbackBody(a.bill))).toEqual({ status: 200, body: { received: true, pending: true } });
    expect(payment(a.paymentId)).toMatchObject({ status: "pending" });

    a.bill.state = "deleted";
    expect(await postCallback(callbackBody(a.bill))).toEqual({ status: 200, body: { received: true, failed: true } });
    expect(payment(a.paymentId)).toMatchObject({ status: "failed", failureReason: "bill_deleted" });
    expect(site("site-a")).toMatchObject({ status: "draft", paid: false, slug: null });
    expect(db.ids("publicSites")).toEqual([]);
  });

  it("publishes once when Billplz repeats or replays the callback", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const a = await openBill(owner, "site-a", "kedai-aisyah-a");
    const lateDue = callbackBody(a.bill); // signed while still due, delivered after the payment
    billplz.pay(a.billId);
    const paid = callbackBody(a.bill);

    const bodies: Doc[] = [];
    for (let i = 0; i < 3; i++) bodies.push((await postCallback(new URLSearchParams(paid))).body);
    expect(bodies).toEqual([
      { received: true, slug: "kedai-aisyah-a", published: true },
      { received: true, slug: "kedai-aisyah-a", published: false },
      { received: true, slug: "kedai-aisyah-a", published: false },
    ]);
    expect(db.ids("publicSites")).toEqual(["kedai-aisyah-a"]);
    expect(db.ids("slugs")).toEqual(["kedai-aisyah-a"]);
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(1);

    // An older "due" callback arriving late never undoes a verified payment.
    expect((await postCallback(lateDue)).body).toEqual({ received: true, pending: true });
    expect(payment(a.paymentId)).toMatchObject({ status: "paid" });
    expect(site("site-a")).toMatchObject({ status: "published", paid: true });
  });

  it("records a second paid bill for a live website as a duplicate and publishes nothing new", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    // Two tabs: two bills opened for the same draft at the same moment, and both paid.
    // (A second Pay press reuses the open bill, so the second bill is recorded directly.)
    const first = await openBill(owner, "site-a", "kedai-aisyah-a");
    const second = { billId: "bill0900", paymentId: "payment-tab-2", bill: { ...first.bill } as Doc };
    Object.assign(second.bill, { id: second.billId, reference_1: second.paymentId, url: `https://www.billplz.com/bills/${second.billId}` });
    billplz.bills.set(second.billId, second.bill);
    db.seed(`payments/${second.paymentId}`, { ...payment(first.paymentId), providerRef: second.billId });
    billplz.pay(first.billId);
    billplz.pay(second.billId);

    expect((await postCallback(callbackBody(first.bill))).body).toEqual({
      received: true,
      slug: "kedai-aisyah-a",
      published: true,
    });
    expect((await postCallback(callbackBody(second.bill))).body).toEqual({
      received: true,
      slug: "kedai-aisyah-a",
      published: false,
    });
    expect(payment(second.paymentId)).toMatchObject({ status: "paid", duplicate: true, providerRef: second.billId });
    expect(payment(first.paymentId).duplicate).toBeUndefined();
    expect(db.ids("publicSites")).toEqual(["kedai-aisyah-a"]);
    const logged = vi.mocked(console.error).mock.calls.map((args) => String(args[0]));
    expect(logged.some((message) => message.includes("refund"))).toBe(true);
  });

  it("doesn't publish a paid amount that isn't the price, and keeps the payment for a refund", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const a = await openBill(owner, "site-a", "kedai-aisyah-a");
    billplz.pay(a.billId, 100);

    expect(await postCallback(callbackBody(a.bill))).toEqual({
      status: 200,
      body: { received: true, slug: null, published: false, needsAttention: true },
    });
    expect(payment(a.paymentId)).toMatchObject({
      status: "paid",
      paidAmountSen: 100,
      amountSen: 14990,
      needsAttention: true,
      attentionReason: "amount_mismatch",
    });
    expect(site("site-a")).toMatchObject({ status: "draft", paid: false });
    expect(db.ids("publicSites")).toEqual([]);
  });

  it("publishes nothing for a signed bill Webbi never opened", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    await openBill(owner, "site-a", "kedai-aisyah-a");
    const stray: Doc = {
      id: "bill9999",
      collection_id: COLLECTION,
      paid: true,
      state: "paid",
      amount: 14990,
      paid_amount: 14990,
      due_at: "2026-9-13",
      email: "someone@example.com",
      name: "SOMEONE",
      url: "https://www.billplz.com/bills/bill9999",
      paid_at: PAID_AT,
    };
    expect(await postCallback(callbackBody(stray))).toEqual({
      status: 200,
      body: { received: true, refused: "not_found" },
    });
    expect(site("site-a")).toMatchObject({ status: "draft", paid: false });
    expect(db.ids("publicSites")).toEqual([]);
  });
});

describe("return page: the redirect alone proves nothing", () => {
  it("doesn't take an unsigned or forged paid=true as payment, and doesn't even ask Billplz", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const a = await openBill(owner, "site-a", "kedai-aisyah-a");
    const claimsPaid = { ...a.bill, paid: true, paid_at: PAID_AT };
    const unsigned = returnQuery(claimsPaid);
    unsigned.delete("billplz[x_signature]");

    for (const body of [
      { siteId: "site-a", sessionId: a.billId, redirectQuery: unsigned.toString() },
      { siteId: "site-a", sessionId: a.billId, redirectQuery: returnQuery(claimsPaid, "someone-elses-key").toString() },
      { siteId: "site-a", sessionId: a.billId },
      { siteId: "site-a", sessionId: a.billId, redirectQuery: "paid=true&billplz%5Bpaid%5D=true", paid: true, status: "paid" },
    ]) {
      expect(await confirmAs(owner, body)).toEqual({ status: 200, body: { status: "pending" } });
    }
    expect(billplz.reads()).toBe(0);
    expect(site("site-a")).toMatchObject({ status: "draft", paid: false, slug: null });
    expect(payment(a.paymentId)).toMatchObject({ status: "pending" });
    expect(db.ids("publicSites")).toEqual([]);
  });

  it("still reads the bill from Billplz after a valid signature, so a due bill stays unpublished", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const a = await openBill(owner, "site-a", "kedai-aisyah-a");

    // Correctly signed but saying paid, while Billplz's own record says due.
    const signedPaid = returnQuery({ ...a.bill, paid: true, paid_at: PAID_AT }).toString();
    expect(await confirmAs(owner, { siteId: "site-a", sessionId: a.billId, redirectQuery: signedPaid })).toEqual({
      status: 200,
      body: { status: "pending" },
    });
    expect(billplz.reads()).toBe(1);

    // Signed and honestly unpaid (cancelled, or the bank declined): the customer is told; the bill stays payable.
    const signedUnpaid = returnQuery(a.bill).toString();
    expect(await confirmAs(owner, { siteId: "site-a", sessionId: a.billId, redirectQuery: signedUnpaid })).toEqual({
      status: 200,
      body: { status: "failed", reason: "not_paid" },
    });
    expect(payment(a.paymentId)).toMatchObject({ status: "pending" });
    expect(site("site-a")).toMatchObject({ status: "draft", paid: false, slug: null });
    expect(db.ids("publicSites")).toEqual([]);
  });

  it("publishes through the same fulfilment once Billplz confirms, and the callback after it changes nothing", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const a = await openBill(owner, "site-a", "kedai-aisyah-a");
    billplz.pay(a.billId);

    const redirectQuery = returnQuery(a.bill).toString();
    expect(await confirmAs(owner, { siteId: "site-a", sessionId: a.billId, redirectQuery })).toEqual({
      status: 200,
      body: { status: "published", slug: "kedai-aisyah-a" },
    });
    expect(site("site-a")).toMatchObject({ status: "published", paid: true, slug: "kedai-aisyah-a" });
    expect((await postCallback(callbackBody(a.bill))).body).toEqual({
      received: true,
      slug: "kedai-aisyah-a",
      published: false,
    });
    expect(db.ids("publicSites")).toEqual(["kedai-aisyah-a"]);
    expect(payment(a.paymentId)).toMatchObject({ status: "paid", providerRef: a.billId });
  });

  it("can't confirm someone else's payment, or spend one bill on another website", async () => {
    const owner = person();
    const intruder = person();
    seedSite("site-a", owner.uid);
    seedSite("site-b", owner.uid);
    seedSite("site-x", intruder.uid);
    const a = await openBill(owner, "site-a", "kedai-aisyah-a");
    billplz.pay(a.billId);
    const redirectQuery = returnQuery(a.bill).toString(); // a genuine, signed return URL

    expect((await confirmAs(intruder, { siteId: "site-x", sessionId: a.billId, redirectQuery })).status).toBe(403);
    expect((await confirmAs(intruder, { siteId: "site-a", sessionId: a.billId, redirectQuery })).status).toBe(403);
    expect((await confirmAs(owner, { siteId: "site-b", sessionId: a.billId, redirectQuery })).status).toBe(403);
    for (const id of ["site-a", "site-b", "site-x"]) {
      expect(site(id)).toMatchObject({ status: "draft", paid: false, slug: null });
    }
    expect(payment(a.paymentId)).toMatchObject({ status: "pending" });
    expect(db.ids("publicSites")).toEqual([]);

    // A return signed for one bill can't be pointed at another.
    const b = await openBill(owner, "site-b", "kedai-aisyah-b");
    billplz.pay(b.billId);
    expect(await confirmAs(owner, { siteId: "site-b", sessionId: b.billId, redirectQuery })).toEqual({
      status: 200,
      body: { status: "pending" },
    });
    expect(site("site-b")).toMatchObject({ status: "draft", paid: false, slug: null });
  });
});

describe("publishing gate", () => {
  it("won't push a website live that nobody has paid for", async () => {
    const owner = person();
    seedSite("draft", owner.uid);
    seedSite("flipped", owner.uid, { status: "published", paid: false, slug: "flipped" });
    seedSite("paid-not-live", owner.uid, { status: "draft", paid: true, slug: "paid-not-live" });
    for (const siteId of ["draft", "flipped", "paid-not-live"]) {
      expect((await send(owner, republish, "/api/publish/republish", { siteId })).status).toBe(409);
    }
    expect(db.ids("publicSites")).toEqual([]);
  });

  it("pushes the owner's edits once the payment has published the website", async () => {
    const owner = person();
    seedSite("site-a", owner.uid);
    const a = await openBill(owner, "site-a", "kedai-aisyah-a");
    billplz.pay(a.billId);
    await postCallback(callbackBody(a.bill));

    expect(await send(owner, republish, "/api/publish/republish", { siteId: "site-a" })).toEqual({
      status: 200,
      body: { status: "published", slug: "kedai-aisyah-a" },
    });
    expect((await send(person(), republish, "/api/publish/republish", { siteId: "site-a" })).status).toBe(404);
  });
});
