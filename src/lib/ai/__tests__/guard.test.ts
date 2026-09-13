import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { Timestamp } from "firebase-admin/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as generateRoute } from "@/app/api/ai/generate/route";
import { POST as understandRoute } from "@/app/api/ai/understand/route";
import { POST as removeRoute } from "@/app/api/sites/delete/route";
import { POST as createRoute } from "@/app/api/sites/route";
import { getAiProvider, type AiProvider } from "@/lib/ai";
import { AiError } from "@/lib/ai/errors";
import { AI_DAILY_LIMIT, AI_LOCK_TTL_MS, AI_MONTHLY_LIMIT, AI_SITE_LIMIT } from "@/lib/ai/guard";
import { createOpenAiProvider } from "@/lib/ai/openai";
import { requireUser, UnauthorizedError, type VerifiedUser } from "@/lib/auth/verify";
import { quotaDay } from "@/lib/site/drafts";
import { FakeFirestore } from "@/test/fakeFirestore";
import { AI_SITE, AI_UNDERSTANDING, DESCRIPTION, INPUT, UNDERSTANDING, draftFields, gate } from "./guardFixtures";

/**
 * Phase B: AI cost protection, through Webbi's real AI routes and guard with
 * Firestore faked in memory (real transaction retries) and the provider faked,
 * either as a stub or as the real OpenAI adapter over a fake fetch. No test
 * reaches a real provider. The rules and a real-transaction race run against
 * the emulator in guard.emulator.test.ts (npm run test:rules).
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
vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  getAiProvider: vi.fn(),
}));

type Doc = Record<string, unknown>;
type Handler = (request: Request) => Promise<Response>;

const BUSY = "You're generating too quickly. Please wait for the current generation to finish.";
const DAILY = "Your AI generation limit has been reached for today. Please try again tomorrow.";
const MONTHLY = "Your AI generation limit has been reached for this month.";
const SITE_LIMIT = "Your generation limit for this website has been reached.";

let db: FakeFirestore;
let people = 0;
let drafts = 0;

function person(overrides: Partial<VerifiedUser> = {}): VerifiedUser {
  people += 1;
  return { uid: `owner-${people}`, isAnonymous: false, email: `owner${people}@example.com`, ...overrides };
}

function seedDraft(ownerUid: string, overrides: Doc = {}): string {
  drafts += 1;
  const id = `draft${drafts}`;
  const now = Timestamp.now();
  db.seed(`sites/${id}`, { ...draftFields(ownerUid), createdAt: now, updatedAt: now, ...overrides });
  return id;
}

const site = (id: string) => db.read(`sites/${id}`);
const usage = (id: string) => db.read(`siteAi/${id}`);
const quota = (uid: string) => db.read(`userQuotas/${uid}`);

async function send(user: VerifiedUser | null, handler: Handler, path: string, body: unknown) {
  if (user) vi.mocked(requireUser).mockResolvedValue(user);
  else vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());
  const response = await handler(
    new Request(`https://webbi.my${path}`, {
      method: "POST",
      headers: { authorization: "Bearer test-token", "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  return { status: response.status, body: (await response.json()) as Doc & { error?: Doc } };
}

const generate = (user: VerifiedUser | null, body: unknown) => send(user, generateRoute, "/api/ai/generate", body);
const understand = (user: VerifiedUser | null, body: unknown) => send(user, understandRoute, "/api/ai/understand", body);

/** The owner pressing "Build my website" again, the way ContentView and "Try again" do. */
function rebuild(siteId: string) {
  const current = site(siteId) as { generation: Doc };
  db.patch(`sites/${siteId}`, { generation: { ...current.generation, status: "generating" } });
}

function fakeProvider() {
  const provider = {
    name: "fake-model",
    understand: vi.fn<AiProvider["understand"]>(async () => structuredClone(AI_UNDERSTANDING)),
    generate: vi.fn<AiProvider["generate"]>(async () => structuredClone(AI_SITE)),
  };
  vi.mocked(getAiProvider).mockReturnValue(provider);
  return provider;
}

/** The real OpenAI adapter with the network faked. */
function openAiOver(handler: (n: number) => Response) {
  const calls: Doc[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    calls.push(JSON.parse(String(init?.body)) as Doc);
    return handler(calls.length);
  };
  vi.mocked(getAiProvider).mockReturnValue(createOpenAiProvider({ fetch: fetchImpl }));
  return calls;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const completion = (content: unknown) =>
  json(200, {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 0,
    model: "gpt-5-mini-2025-08-07",
    choices: [
      { index: 0, message: { role: "assistant", content: JSON.stringify(content), refusal: null }, finish_reason: "stop", logprobs: null },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  });

const day = () => quotaDay();
const month = () => quotaDay().slice(0, 7);

/** Nothing was counted or locked for this account and website. */
function expectUntouched(uid: string, siteId: string) {
  expect(quota(uid)).toBeUndefined();
  expect(usage(siteId)).toBeUndefined();
}

let provider: ReturnType<typeof fakeProvider>;

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("OPENAI_API_KEY", "sk-test-not-a-real-key");
  db = new FakeFirestore();
  firestore.db = db;
  provider = fakeProvider();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("who can use the AI", () => {
  it("lets the owner build their draft from what is saved on it, and saves the result on the server", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);

    const res = await generate(owner, { siteId });

    expect(res.status).toBe(200);
    expect(res.body.model).toBe("fake-model");
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(provider.generate).toHaveBeenCalledWith({
      description: DESCRIPTION,
      language: "ms",
      tone: "friendly",
      highlights: ["Boleh buat loan"],
      ctaLabel: "Book Test Drive",
      input: INPUT,
    });
    expect(site(siteId)).toMatchObject({
      draft: res.body.site,
      generation: { status: "ready", model: "fake-model", input: INPUT, understanding: UNDERSTANDING },
    });
    expect(usage(siteId)).toMatchObject({ ownerUid: owner.uid, generations: 1, lock: null });
    expect(quota(owner.uid)).toMatchObject({ aiDay: day(), aiRequestsToday: 1, aiMonth: month(), aiRequestsThisMonth: 1 });
  });

  it("refuses a request without a signed-in user (401) and calls nothing", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);
    for (const call of [generate, understand]) {
      const res = await call(null, { siteId });
      expect(res.status).toBe(401);
      expect(res.body.error?.code).toBe("unauthenticated");
    }
    expect(provider.generate).not.toHaveBeenCalled();
    expect(provider.understand).not.toHaveBeenCalled();
    expectUntouched(owner.uid, siteId);
  });

  it("refuses guests (403), even on a draft they own", async () => {
    const guest = person({ isAnonymous: true, email: undefined });
    const siteId = seedDraft(guest.uid);
    for (const call of [generate, understand]) {
      const res = await call(guest, { siteId });
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe("forbidden");
    }
    expect(provider.generate).not.toHaveBeenCalled();
    expectUntouched(guest.uid, siteId);
  });

  it("refuses another account's website (403) without counting anything for either account", async () => {
    const owner = person();
    const intruder = person();
    const siteId = seedDraft(owner.uid);

    for (const call of [generate, understand]) {
      const res = await call(intruder, { siteId, ownerUid: intruder.uid, uid: intruder.uid });
      expect(res.status).toBe(403);
    }
    expect(provider.generate).not.toHaveBeenCalled();
    expectUntouched(intruder.uid, siteId);
    expect(quota(owner.uid)).toBeUndefined();
    expect(site(siteId)).toMatchObject({ draft: null, generation: { status: "generating" } });
  });

  it("answers 404 for a website that doesn't exist and 403 for a published one", async () => {
    const owner = person();
    expect((await generate(owner, { siteId: "no-such-site" })).status).toBe(404);
    const live = seedDraft(owner.uid, { status: "published", paid: true });
    expect((await generate(owner, { siteId: live })).status).toBe(403);
    expect(provider.generate).not.toHaveBeenCalled();
    expectUntouched(owner.uid, live);
  });

  it("refuses a missing or malformed siteId (400) without counting anything", async () => {
    const owner = person();
    for (const body of [{}, { siteId: "" }, { siteId: "a/b" }, { siteId: 42 }, "not json", { description: DESCRIPTION, input: INPUT }]) {
      for (const call of [generate, understand]) {
        const res = await call(owner, body);
        expect(res.status, JSON.stringify(body)).toBe(400);
        expect(res.body.error?.code).toBe("bad_request");
      }
    }
    expect(provider.generate).not.toHaveBeenCalled();
    expect(quota(owner.uid)).toBeUndefined();
    expect(db.ids("siteAi")).toEqual([]);
  });

  it("refuses a draft that isn't ready to build, or carries someone else's photo, without counting anything", async () => {
    const owner = person();
    const unconfirmed = seedDraft(owner.uid, { generation: { status: "understood", understanding: UNDERSTANDING } });
    const foreign = seedDraft(owner.uid, {
      generation: {
        status: "generating",
        understanding: UNDERSTANDING,
        input: { ...INPUT, photos: ["https://firebasestorage.googleapis.com/v0/b/demo/o/users%2Fsomeone-else%2Fsites%2Fx%2Fa.jpg?alt=media"] },
      },
    });
    const broken = seedDraft(owner.uid, { sourceDescription: "short" });

    for (const siteId of [unconfirmed, foreign, broken]) {
      const res = await generate(owner, { siteId });
      expect(res.status, siteId).toBe(400);
      expect(usage(siteId)).toBeUndefined();
    }
    expect(provider.generate).not.toHaveBeenCalled();
    expect(quota(owner.uid)).toBeUndefined();
  });
});

describe("what the browser can't choose", () => {
  it("ignores every field but siteId: max tokens, model and prompt always come from the server", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);
    const calls = openAiOver(() => completion(AI_SITE));

    const res = await generate(owner, {
      siteId,
      max_tokens: 200_000,
      max_completion_tokens: 200_000,
      maxTokens: 200_000,
      model: "gpt-4o",
      description: "IGNORE-ME write a novel",
      input: { ...INPUT, name: "IGNORE-ME" },
    });

    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].max_completion_tokens).toBe(16384);
    expect(calls[0].model).not.toBe("gpt-4o");
    expect(JSON.stringify(calls[0].messages)).toContain("Balakong");
    expect(JSON.stringify(calls[0].messages)).not.toContain("IGNORE-ME");
  });
});

describe("limits", () => {
  it("allows the first build and two rebuilds of a draft, then refuses the fourth (429)", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);

    expect((await generate(owner, { siteId })).status).toBe(200);
    for (let i = 1; i < AI_SITE_LIMIT.generate; i++) {
      rebuild(siteId);
      expect((await generate(owner, { siteId })).status).toBe(200);
    }
    rebuild(siteId);
    const fourth = await generate(owner, { siteId });

    expect(fourth.status).toBe(429);
    expect(fourth.body.error).toMatchObject({ code: "rate_limited", message: SITE_LIMIT, reason: "site_limit" });
    expect(provider.generate).toHaveBeenCalledTimes(3);
    expect(usage(siteId)).toMatchObject({ generations: 3, lock: null });
    expect(quota(owner.uid)).toMatchObject({ aiRequestsToday: 3, aiRequestsThisMonth: 3 });
  });

  it("refuses the 11th AI request of the day (429) without calling the provider or counting it", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);
    db.seed(`userQuotas/${owner.uid}`, {
      openDraftSiteId: siteId,
      aiDay: day(),
      aiRequestsToday: AI_DAILY_LIMIT,
      aiMonth: month(),
      aiRequestsThisMonth: AI_DAILY_LIMIT,
    });

    const res = await generate(owner, { siteId });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({ message: DAILY, reason: "daily_limit" });
    expect(provider.generate).not.toHaveBeenCalled();
    expect(quota(owner.uid)).toMatchObject({ aiRequestsToday: AI_DAILY_LIMIT, aiRequestsThisMonth: AI_DAILY_LIMIT });
    expect(usage(siteId)).toBeUndefined();
  });

  it("starts each Malaysia day from zero", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);
    db.seed(`userQuotas/${owner.uid}`, { aiDay: "2000-01-01", aiRequestsToday: AI_DAILY_LIMIT, aiMonth: "2000-01", aiRequestsThisMonth: 29 });

    expect((await generate(owner, { siteId })).status).toBe(200);
    expect(quota(owner.uid)).toMatchObject({ aiDay: day(), aiRequestsToday: 1, aiMonth: month(), aiRequestsThisMonth: 1 });
  });

  it("refuses the 31st AI request of the month (429) without calling the provider or counting it", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);
    db.seed(`userQuotas/${owner.uid}`, { aiDay: "2000-01-01", aiRequestsToday: 0, aiMonth: month(), aiRequestsThisMonth: AI_MONTHLY_LIMIT });

    const res = await generate(owner, { siteId });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({ message: MONTHLY, reason: "monthly_limit" });
    expect(provider.generate).not.toHaveBeenCalled();
    expect(quota(owner.uid)).toMatchObject({ aiRequestsThisMonth: AI_MONTHLY_LIMIT, aiDay: "2000-01-01" });
    expect(usage(siteId)).toBeUndefined();
  });

  it("counts reading the description and building the website against the same daily allowance", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid, { generation: { status: "understanding" } });
    db.seed(`userQuotas/${owner.uid}`, { aiDay: day(), aiRequestsToday: AI_DAILY_LIMIT - 1, aiMonth: month(), aiRequestsThisMonth: 9 });

    expect((await understand(owner, { siteId })).status).toBe(200);
    db.patch(`sites/${siteId}`, { generation: { status: "generating", understanding: UNDERSTANDING, input: INPUT } });
    const res = await generate(owner, { siteId });

    expect(res.status).toBe(429);
    expect(res.body.error?.reason).toBe("daily_limit");
    expect(provider.generate).not.toHaveBeenCalled();
  });
});

describe("one AI request per website at a time", () => {
  it("lets exactly one of two simultaneous builds reach the provider; the other gets 409 and counts nothing", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);
    const held = gate();
    provider.generate.mockImplementation(async () => {
      await held.opened;
      return structuredClone(AI_SITE);
    });

    const first = generate(owner, { siteId });
    const second = generate(owner, { siteId });
    // The refused request answers while the accepted one is still with the provider.
    const refused = await Promise.race([first, second]);
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatchObject({ code: "conflict", message: BUSY, reason: "busy" });
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(usage(siteId)?.lock).toMatchObject({ kind: "generate" });

    held.open();
    const statuses = (await Promise.all([first, second])).map((res) => res.status).sort();

    expect(statuses).toEqual([200, 409]);
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(usage(siteId)).toMatchObject({ generations: 1, lock: null });
    expect(quota(owner.uid)).toMatchObject({ aiRequestsToday: 1, aiRequestsThisMonth: 1 });
  });

  it("releases the lock after a success, so a rebuild can start", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);
    expect((await generate(owner, { siteId })).status).toBe(200);
    expect(usage(siteId)?.lock).toBeNull();
    rebuild(siteId);
    expect((await generate(owner, { siteId })).status).toBe(200);
  });

  it("releases the lock after a provider failure, which still counts", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);
    provider.generate.mockRejectedValueOnce(new AiError("provider_error", "The AI took too long to respond. Please try again."));

    const res = await generate(owner, { siteId });

    expect(res.status).toBe(502);
    expect(usage(siteId)).toMatchObject({ generations: 1, lock: null });
    expect(quota(owner.uid)).toMatchObject({ aiRequestsToday: 1 });
    expect(site(siteId)).toMatchObject({ draft: null });
    expect((await generate(owner, { siteId })).status).toBe(200);
  });

  it("refuses while a live lock is held, and takes over a lock left behind by a request that died", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);
    const lock = { requestId: "earlier-request", kind: "generate", startedAt: Date.now() - 5_000 };
    db.seed(`siteAi/${siteId}`, { ownerUid: owner.uid, generations: 1, lock });

    const busy = await generate(owner, { siteId });
    expect(busy.status).toBe(409);
    expect(provider.generate).not.toHaveBeenCalled();
    expect(usage(siteId)).toMatchObject({ generations: 1, lock });
    expect(quota(owner.uid)).toBeUndefined();

    db.patch(`siteAi/${siteId}`, { lock: { ...lock, startedAt: Date.now() - AI_LOCK_TTL_MS - 1 } });
    const recovered = await generate(owner, { siteId });

    expect(recovered.status).toBe(200);
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(usage(siteId)).toMatchObject({ generations: 2, lock: null });
  });
});

describe("refunds and safe errors", () => {
  it("gives the request back when the provider turned it away before doing any work", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);
    db.seed(`userQuotas/${owner.uid}`, { openDraftSiteId: siteId, aiDay: day(), aiRequestsToday: 4, aiMonth: month(), aiRequestsThisMonth: 7 });
    provider.generate.mockRejectedValueOnce(
      new AiError("ai_not_configured", "Webbi's AI isn't connected yet. Add OPENAI_API_KEY to the server environment."),
    );

    const res = await generate(owner, { siteId });

    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toMatch(/OPENAI|API_KEY|environment/i);
    expect(usage(siteId)).toMatchObject({ generations: 0, lock: null });
    expect(quota(owner.uid)).toMatchObject({ openDraftSiteId: siteId, aiRequestsToday: 4, aiRequestsThisMonth: 7 });
  });

  it("never passes a provider's own error text through, and gives back a rejected key", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);
    openAiOver(() =>
      json(401, { error: { message: "Incorrect API key provided: sk-test-****-key.", type: "invalid_request_error", code: "invalid_api_key" } }),
    );

    const res = await generate(owner, { siteId });

    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toMatch(/OPENAI|API key|sk-test|invalid_api_key/i);
    expect(usage(siteId)).toMatchObject({ generations: 0, lock: null });
    expect(quota(owner.uid)).toMatchObject({ aiRequestsToday: 0 });
  });

  it("answers an unexpected failure with a generic 500 and no internals", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid, { generation: { status: "understanding" } });
    provider.understand.mockRejectedValueOnce(new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 at adminDb (admin.ts:12)"));

    const res = await understand(owner, { siteId });

    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({ code: "internal", message: "Something went wrong on our side. Please try again." });
    expect(usage(siteId)).toMatchObject({ understandings: 1, lock: null });
  });
});

describe("retries are finite", () => {
  it("makes one provider call for a build that fails at the provider, and at most two for reading a description", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);
    const failing = () => json(500, { error: { message: "upstream", type: "server_error", code: null } });

    const calls = openAiOver(failing);
    expect((await generate(owner, { siteId })).status).toBe(502);
    expect(calls).toHaveLength(1);

    const pending = seedDraft(person().uid, { generation: { status: "understanding" } });
    const reader = (site(pending) as { ownerUid: string }).ownerUid;
    const understandCalls = openAiOver(failing);
    expect((await understand({ uid: reader, isAnonymous: false }, { siteId: pending })).status).toBe(502);
    expect(understandCalls).toHaveLength(2);
  }, 20_000);

  it("retries unusable output once, then fails with one counted request", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);
    provider.generate.mockResolvedValue({} as never);

    const res = await generate(owner, { siteId });

    expect(res.status).toBe(502);
    expect(res.body.error?.message).toBe("The website came back incomplete. Please try again.");
    expect(provider.generate).toHaveBeenCalledTimes(2);
    expect(usage(siteId)).toMatchObject({ generations: 1, lock: null });
    expect(quota(owner.uid)).toMatchObject({ aiRequestsToday: 1 });
  });
});

describe("reading the description", () => {
  it("reads the description saved on a new website and saves what it understood", async () => {
    const owner = person();
    const created = await send(owner, createRoute, "/api/sites", { sourceDescription: DESCRIPTION });
    expect(created.status).toBe(201);
    const siteId = String(created.body.siteId);
    expect(site(siteId)).toMatchObject({ generation: { status: "understanding" }, language: "en" });

    const res = await understand(owner, { siteId, description: "IGNORE-ME" });

    expect(res.status).toBe(200);
    expect(provider.understand).toHaveBeenCalledWith({ description: DESCRIPTION });
    expect(site(siteId)).toMatchObject({
      language: "ms",
      generation: { status: "understood", understanding: res.body.understanding },
    });
    expect(usage(siteId)).toMatchObject({ understandings: 1, lock: null });
    expect(quota(owner.uid)).toMatchObject({ openDraftSiteId: siteId, draftsCreatedToday: 1, aiRequestsToday: 1 });
  });

  it("refuses to re-read a website that is already being built, and stops after three reads", async () => {
    const owner = person();
    const building = seedDraft(owner.uid);
    expect((await understand(owner, { siteId: building })).status).toBe(400);
    expect(usage(building)).toBeUndefined();

    const fresh = seedDraft(owner.uid, { generation: { status: "understanding" } });
    for (let i = 0; i < AI_SITE_LIMIT.understand; i++) expect((await understand(owner, { siteId: fresh })).status).toBe(200);
    const res = await understand(owner, { siteId: fresh });
    expect(res.status).toBe(429);
    expect(res.body.error?.reason).toBe("site_limit");
    expect(provider.understand).toHaveBeenCalledTimes(3);
  });
});

describe("with Phase A's website limits", () => {
  it("keeps the account's AI counts when it starts a website", async () => {
    const owner = person();
    db.seed(`userQuotas/${owner.uid}`, { openDraftSiteId: null, aiDay: day(), aiRequestsToday: 6, aiMonth: month(), aiRequestsThisMonth: 20 });

    expect((await send(owner, createRoute, "/api/sites", { sourceDescription: DESCRIPTION })).status).toBe(201);

    expect(quota(owner.uid)).toMatchObject({ draftsCreatedToday: 1, aiDay: day(), aiRequestsToday: 6, aiRequestsThisMonth: 20 });
  });

  it("deletes a draft's AI record with the draft, but never gives back the account's AI requests", async () => {
    const owner = person();
    const created = await send(owner, createRoute, "/api/sites", { sourceDescription: DESCRIPTION });
    const siteId = String(created.body.siteId);
    expect((await understand(owner, { siteId })).status).toBe(200);

    expect((await send(owner, removeRoute, "/api/sites/delete", { siteId })).status).toBe(200);

    expect(site(siteId)).toBeUndefined();
    expect(usage(siteId)).toBeUndefined();
    expect(quota(owner.uid)).toMatchObject({ openDraftSiteId: null, aiRequestsToday: 1, aiRequestsThisMonth: 1 });
  });

  it("doesn't bring back a draft deleted while it was being built", async () => {
    const owner = person();
    const siteId = seedDraft(owner.uid);
    provider.generate.mockImplementationOnce(async () => {
      expect((await send(owner, removeRoute, "/api/sites/delete", { siteId })).status).toBe(200);
      return structuredClone(AI_SITE);
    });

    await generate(owner, { siteId });

    expect(site(siteId)).toBeUndefined();
    expect(usage(siteId)).toBeUndefined();
  });
});

describe("no AI route gets around the guard", () => {
  const ROOT = process.cwd();
  const rel = (file: string) => relative(ROOT, file).split("\\").join("/");
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === "__tests__" ? [] : walk(path);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
  }
  const source = walk(join(ROOT, "src")).map((file) => ({ file: rel(file), text: readFileSync(file, "utf8") }));

  it("reaches a provider only through runAiJob, from exactly the two AI routes", () => {
    const callers = source.filter(({ text }) => /\bgetAiProvider\b/.test(text)).map(({ file }) => file);
    expect(callers.sort()).toEqual(["src/lib/ai/guard.ts", "src/lib/ai/index.ts"]);

    const adapters = source
      .filter(
        ({ file, text }) =>
          /from\s+["']@\/lib\/ai\/(openai|anthropic|mock)["']/.test(text) ||
          (file.startsWith("src/lib/ai/") && /from\s+["']\.\/(openai|anthropic|mock)["']/.test(text)),
      )
      .map(({ file }) => file);
    expect(adapters).toEqual(["src/lib/ai/index.ts"]);

    const sdks = source.filter(({ text }) => /from\s+["'](openai|@anthropic-ai\/sdk)(\/[^"']*)?["']/.test(text)).map(({ file }) => file);
    expect(sdks.every((file) => file.startsWith("src/lib/ai/"))).toBe(true);

    // Pages may use pure helpers such as normalizeMyPhone; only server routes can call a provider.
    const aiRoutes = source.filter(
      ({ file, text }) => file.startsWith("src/app/api/") && /@\/lib\/ai(\/guard|\/index)?["']/.test(text),
    );
    expect(aiRoutes.map(({ file }) => file).sort()).toEqual(["src/app/api/ai/generate/route.ts", "src/app/api/ai/understand/route.ts"]);
    for (const { file, text } of aiRoutes) expect(text, file).toMatch(/\brunAiJob\(/);
  });
});
