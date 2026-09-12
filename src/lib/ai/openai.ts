import "server-only";
import OpenAI from "openai";
import type { z } from "zod";
import { serverEnv } from "@/lib/env";
import { AiError } from "./errors";
import { toOpenAiStrictSchema } from "./openaiSchema";
import { GENERATE_SYSTEM, UNDERSTAND_SYSTEM, buildGenerateUserMessage } from "./prompts";
import type { AiProvider, GenerateRequest, UnderstandRequest } from "./provider";
import { aiSiteSchema, aiUnderstandingSchema, type AiSite, type AiUnderstanding } from "./schemas";

/**
 * OpenAI adapter — Chat Completions with strict Structured Outputs.
 *
 * Runs on the server only (`server-only` makes any client import a build
 * error). The key comes from OPENAI_API_KEY and never leaves this module: the
 * routes return the validated AiUnderstanding / AiSite objects and nothing
 * else. The model only ever produces data matching our zod schemas; it cannot
 * emit HTML or arbitrary keys.
 *
 * Netlify runs route handlers as synchronous functions capped at 60 seconds,
 * so every call carries a deadline that fits inside that cap. generate() does
 * not retry by itself — a second 45-second attempt would overrun the cap and
 * double the cost — the user gets a "Try again" button instead.
 */

const UNDERSTAND_SCHEMA = toOpenAiStrictSchema(aiUnderstandingSchema);
const SITE_SCHEMA = toOpenAiStrictSchema(aiSiteSchema);

/** Models that accept `reasoning_effort` (GPT-5 family and o-series). */
const REASONING_MODEL = /^(gpt-5|o[1-9])/;

type Options = { fetch?: typeof fetch };

export function createOpenAiProvider(options: Options = {}): AiProvider {
  let client: OpenAI | undefined;
  let clientKey: string | undefined;

  function getClient(): OpenAI {
    const apiKey = serverEnv.openaiApiKey;
    if (!apiKey) {
      throw new AiError("ai_not_configured", "Webbi's AI isn't connected yet. Add OPENAI_API_KEY to the server environment.");
    }
    if (!client || clientKey !== apiKey) {
      client = new OpenAI({ apiKey, maxRetries: 0, fetch: options.fetch });
      clientKey = apiKey;
    }
    return client;
  }

  async function complete<T>(spec: {
    name: string;
    system: string;
    user: string;
    jsonSchema: Record<string, unknown>;
    schema: z.ZodType<T>;
    maxTokens: number;
    timeout: number;
    maxRetries: number;
    incomplete: string;
  }): Promise<T> {
    const model = serverEnv.openaiModel;
    const request = (withReasoning: boolean): OpenAI.Chat.ChatCompletionCreateParamsNonStreaming => ({
      model,
      messages: [
        { role: "system", content: spec.system },
        { role: "user", content: spec.user },
      ],
      max_completion_tokens: spec.maxTokens,
      response_format: { type: "json_schema", json_schema: { name: spec.name, strict: true, schema: spec.jsonSchema } },
      ...(withReasoning ? { reasoning_effort: "low" as const } : {}),
    });

    let completion: OpenAI.Chat.ChatCompletion;
    try {
      completion = await getClient().chat.completions.create(request(REASONING_MODEL.test(model)), {
        timeout: spec.timeout,
        maxRetries: spec.maxRetries,
      });
    } catch (error) {
      // A model that matches the family prefix but rejects reasoning_effort: retry once without it.
      if (error instanceof OpenAI.BadRequestError && /reasoning_effort/.test(error.message) && REASONING_MODEL.test(model)) {
        completion = await getClient().chat.completions.create(request(false), { timeout: spec.timeout, maxRetries: 0 });
      } else {
        throw error;
      }
    }

    const choice = completion.choices[0];
    if (!choice) throw new AiError("bad_output", spec.incomplete);
    if (choice.message.refusal) {
      console.warn("[ai] openai refusal", choice.message.refusal.slice(0, 200));
      throw new AiError("bad_output", "Webbi couldn't write that one. Try rewording your description.");
    }
    if (choice.finish_reason === "length" || !choice.message.content) {
      console.warn("[ai] openai incomplete output", choice.finish_reason, completion.usage);
      throw new AiError("bad_output", spec.incomplete);
    }
    let json: unknown;
    try {
      json = JSON.parse(choice.message.content);
    } catch {
      throw new AiError("bad_output", spec.incomplete);
    }
    const parsed = spec.schema.safeParse(json);
    if (!parsed.success) {
      console.error("[ai] openai output failed validation", parsed.error.issues.slice(0, 5));
      throw new AiError("bad_output", spec.incomplete);
    }
    return parsed.data;
  }

  function wrap(error: unknown): never {
    if (error instanceof AiError) throw error;
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      console.error("[ai] openai timeout");
      throw new AiError("provider_error", "Webbi's AI took too long. Please try again.");
    }
    if (error instanceof OpenAI.APIError) {
      console.error("[ai] openai error", error.status, error.code, error.message);
      if (error.status === 401) throw new AiError("ai_not_configured", "The AI key was rejected. Check OPENAI_API_KEY.");
      if (error.status === 404) {
        throw new AiError("ai_not_configured", `The AI model "${serverEnv.openaiModel}" isn't available on this key. Check OPENAI_MODEL.`);
      }
      if (error.status === 429 && error.code === "insufficient_quota") {
        throw new AiError("ai_not_configured", "Webbi's AI account is out of credit. Please try again later.");
      }
      if (error.status === 429) throw new AiError("rate_limited", "Webbi is busy right now. Try again in a minute.");
      throw new AiError("provider_error", "Webbi couldn't reach its AI. Please try again.");
    }
    console.error("[ai] unexpected", error);
    throw new AiError("provider_error", "Webbi couldn't build this right now. Please try again.");
  }

  return {
    name: "openai",

    async understand({ description }: UnderstandRequest): Promise<AiUnderstanding> {
      try {
        return await complete({
          name: "webbi_understanding",
          system: UNDERSTAND_SYSTEM,
          user: `DESCRIPTION:\n${description.trim()}`,
          jsonSchema: UNDERSTAND_SCHEMA,
          schema: aiUnderstandingSchema,
          maxTokens: 4096,
          timeout: 25_000,
          maxRetries: 1,
          incomplete: "Webbi couldn't read that. Try adding a little more detail.",
        });
      } catch (error) {
        wrap(error);
      }
    },

    async generate(request: GenerateRequest): Promise<AiSite> {
      try {
        return await complete({
          name: "webbi_site",
          system: GENERATE_SYSTEM,
          user: buildGenerateUserMessage(request),
          jsonSchema: SITE_SCHEMA,
          schema: aiSiteSchema,
          maxTokens: 16_384,
          timeout: 50_000,
          maxRetries: 0,
          incomplete: "The draft came back incomplete. Please try again.",
        });
      } catch (error) {
        wrap(error);
      }
    },
  };
}

export const openaiProvider = createOpenAiProvider();
