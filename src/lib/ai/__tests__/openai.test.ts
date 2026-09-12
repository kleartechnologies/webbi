import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PRESET_IDS } from "@/lib/site/presets";
import { AiError } from "../errors";
import { createOpenAiProvider } from "../openai";
import { toOpenAiStrictSchema } from "../openaiSchema";
import { aiSiteSchema, aiUnderstandingSchema } from "../schemas";

type Json = Record<string, unknown>;

function walk(node: unknown, visit: (n: Json) => void) {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  if (!node || typeof node !== "object") return;
  visit(node as Json);
  Object.values(node as Json).forEach((v) => walk(v, visit));
}

describe("toOpenAiStrictSchema", () => {
  it("emits only keywords OpenAI strict mode accepts", () => {
    for (const schema of [aiUnderstandingSchema, aiSiteSchema]) {
      const json = toOpenAiStrictSchema(schema);
      expect(json.type).toBe("object");
      expect(json.$schema).toBeUndefined();
      walk(json, (n) => {
        for (const banned of ["minLength", "maxLength", "minItems", "maxItems", "const", "oneOf", "$ref", "$defs", "default"]) {
          expect(n, `unexpected ${banned}`).not.toHaveProperty(banned);
        }
        if (n.type === "object") {
          expect(n.additionalProperties).toBe(false);
          expect(n.required).toEqual(Object.keys(n.properties as Json));
        }
      });
    }
  });

  it("keeps length limits as description hints and literals as enums", () => {
    const json = toOpenAiStrictSchema(aiSiteSchema) as { properties: Json };
    const sections = json.properties.sections as Json;
    expect(sections.description).toContain("max 10 items");
    const hero = (sections.items as Json).anyOf as Json[];
    expect(hero.length).toBe(8);
    expect(((hero[0].properties as Json).type as Json).enum).toEqual(["hero"]);
    const name = ((json.properties.business as Json).properties as Json).name as Json;
    expect(name.description).toContain("max 80 characters");
  });
});

const understanding = {
  language: "ms",
  name: "Amir Perodua Balakong",
  category: "car",
  categoryConfidence: "high",
  tagline: "Kereta baru, loan senang",
  area: "Balakong",
  whatsapp: null,
  offerings: [{ name: "Perodua Myvi", price: null }],
  highlights: ["Boleh buat loan"],
  ctaLabel: "Book Test Drive",
  tone: "friendly",
  summary: "Sales advisor Perodua di Balakong yang bantu cari kereta baru dan loan.",
  instagram: null,
  facebook: null,
  tiktok: null,
};

const site = {
  language: "ms",
  business: { name: "Amir Perodua Balakong", tagline: null, area: "Balakong" },
  theme: { preset: PRESET_IDS[0] },
  cta: { label: "Book Test Drive", message: null },
  sections: [
    { type: "hero", headline: "Kereta Perodua baru di Balakong", subheadline: null, badge: null, presentationMode: null },
    { type: "contact", title: null, body: null },
    { type: "cta", headline: "Nak test drive?", body: null },
  ],
};

type Call = { url: string; headers: Headers; body: Json };

function fakeFetch(handler: (call: Call, n: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const call = { url: String(input), headers: new Headers(init?.headers as HeadersInit), body: JSON.parse(String(init?.body)) as Json };
    calls.push(call);
    return handler(call, calls.length);
  };
  return { fetchImpl, calls };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const completion = (message: Json, finish_reason = "stop") =>
  json(200, {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 0,
    model: "gpt-5-mini-2025-08-07",
    choices: [{ index: 0, message: { role: "assistant", content: null, refusal: null, ...message }, finish_reason, logprobs: null }],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  });

const apiError = (status: number, code: string | null, message = "error") =>
  json(status, { error: { message, type: "invalid_request_error", code, param: null } });

const generateRequest = {
  description: "Saya jual kereta Perodua dekat Balakong. Nama saya Amir.",
  language: "ms" as const,
  input: {
    category: "car" as const,
    name: "Amir Perodua Balakong",
    tagline: "",
    whatsapp: "60123456789",
    area: "Balakong",
    address: "",
    hours: "",
    instagram: "",
    facebook: "",
    tiktok: "",
    offerings: [],
    photos: [],
  },
};

async function expectAiError(promise: Promise<unknown>, code: string, messagePart?: RegExp) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AiError);
  expect((error as AiError).code).toBe(code);
  if (messagePart) expect((error as AiError).message).toMatch(messagePart);
}

describe("openaiProvider", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";
    delete process.env.OPENAI_MODEL;
  });
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  it("refuses to run without OPENAI_API_KEY and never calls the network", async () => {
    delete process.env.OPENAI_API_KEY;
    const { fetchImpl, calls } = fakeFetch(() => completion({ content: JSON.stringify(understanding) }));
    const provider = createOpenAiProvider({ fetch: fetchImpl });
    await expectAiError(provider.understand({ description: "Kedai makan di Kajang" }), "ai_not_configured", /OPENAI_API_KEY/);
    expect(calls.length).toBe(0);
  });

  it("understand() sends a strict json_schema request and returns the validated object", async () => {
    const { fetchImpl, calls } = fakeFetch(() => completion({ content: JSON.stringify(understanding) }));
    const provider = createOpenAiProvider({ fetch: fetchImpl });
    const result = await provider.understand({ description: "Saya jual kereta Perodua dekat Balakong. Nama saya Amir." });
    expect(result).toEqual(understanding);
    expect(calls.length).toBe(1);
    const [call] = calls;
    expect(call.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(call.headers.get("authorization")).toBe("Bearer sk-test-not-a-real-key");
    expect(call.body.model).toBe("gpt-5-mini");
    expect(call.body.reasoning_effort).toBe("low");
    expect(call.body.max_completion_tokens).toBe(4096);
    expect(call.body.stream).toBeUndefined();
    const format = call.body.response_format as Json;
    expect(format.type).toBe("json_schema");
    expect((format.json_schema as Json).strict).toBe(true);
    expect((format.json_schema as Json).name).toBe("webbi_understanding");
    const messages = call.body.messages as Json[];
    expect(messages[0].role).toBe("system");
    expect(messages[1].content).toContain("Balakong");
    // The key is never part of the result the route would send back.
    expect(JSON.stringify(result)).not.toContain("sk-test");
  });

  it("generate() uses the site schema without retries and validates the draft", async () => {
    const { fetchImpl, calls } = fakeFetch(() => completion({ content: JSON.stringify(site) }));
    const provider = createOpenAiProvider({ fetch: fetchImpl });
    const result = await provider.generate(generateRequest);
    expect(result.sections.length).toBe(3);
    expect(((calls[0].body.response_format as Json).json_schema as Json).name).toBe("webbi_site");
    expect(calls[0].body.max_completion_tokens).toBe(16384);
  });

  it("omits reasoning_effort for models outside the GPT-5 / o-series families", async () => {
    process.env.OPENAI_MODEL = "gpt-4.1-mini";
    const { fetchImpl, calls } = fakeFetch(() => completion({ content: JSON.stringify(understanding) }));
    await createOpenAiProvider({ fetch: fetchImpl }).understand({ description: "Kedai makan di Kajang, nasi lemak" });
    expect(calls[0].body.model).toBe("gpt-4.1-mini");
    expect(calls[0].body).not.toHaveProperty("reasoning_effort");
  });

  it("retries once without reasoning_effort when the model rejects it", async () => {
    const { fetchImpl, calls } = fakeFetch((call) =>
      "reasoning_effort" in call.body
        ? apiError(400, "unsupported_parameter", "Unsupported parameter: 'reasoning_effort' is not supported with this model.")
        : completion({ content: JSON.stringify(understanding) }),
    );
    const result = await createOpenAiProvider({ fetch: fetchImpl }).understand({ description: "Kedai makan di Kajang, nasi lemak" });
    expect(result.category).toBe("car");
    expect(calls.length).toBe(2);
    expect(calls[1].body).not.toHaveProperty("reasoning_effort");
  });

  it("maps refusals, truncation, non-JSON and schema violations to bad_output", async () => {
    const cases: Array<[Json, string]> = [
      [{ refusal: "I can't help with that." }, "stop"],
      [{ content: JSON.stringify(understanding).slice(0, 40) }, "length"],
      [{ content: "not json" }, "stop"],
      [{ content: JSON.stringify({ ...understanding, category: "spaceship" }) }, "stop"],
      [{ content: null }, "stop"],
    ];
    for (const [message, finish] of cases) {
      const { fetchImpl } = fakeFetch(() => completion(message, finish));
      await expectAiError(createOpenAiProvider({ fetch: fetchImpl }).understand({ description: "Kedai makan di Kajang, nasi lemak" }), "bad_output");
    }
  });

  it("maps API failures to the shared AiError codes", async () => {
    const cases: Array<[number, string | null, string, RegExp]> = [
      [401, "invalid_api_key", "ai_not_configured", /OPENAI_API_KEY/],
      [404, "model_not_found", "ai_not_configured", /OPENAI_MODEL/],
      [429, "insufficient_quota", "ai_not_configured", /credit/],
      [429, "rate_limit_exceeded", "rate_limited", /busy/],
      [500, null, "provider_error", /try again/i],
    ];
    for (const [status, code, expected, message] of cases) {
      const { fetchImpl } = fakeFetch(() => apiError(status, code));
      // generate() has maxRetries 0, so each case is a single request.
      await expectAiError(createOpenAiProvider({ fetch: fetchImpl }).generate(generateRequest), expected, message);
    }
  });

  it("never echoes the API key in error messages", async () => {
    const { fetchImpl } = fakeFetch(() => apiError(401, "invalid_api_key", "Incorrect API key provided: sk-test-not-a-real-key"));
    const error = await createOpenAiProvider({ fetch: fetchImpl })
      .generate(generateRequest)
      .then(() => null, (e: unknown) => e as AiError);
    expect(error?.message).not.toContain("sk-test");
  });
});
