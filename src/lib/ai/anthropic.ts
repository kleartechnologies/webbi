import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { serverEnv } from "@/lib/env";
import { AiError } from "./errors";
import { GENERATE_SYSTEM, UNDERSTAND_SYSTEM, buildGenerateUserMessage } from "./prompts";
import type { AiProvider, GenerateRequest, UnderstandRequest } from "./provider";
import { aiSiteSchema, aiUnderstandingSchema, type AiSite, type AiUnderstanding } from "./schemas";

let client: Anthropic | undefined;

function getClient(): Anthropic {
  const apiKey = serverEnv.anthropicApiKey;
  if (!apiKey) {
    throw new AiError(
      "ai_not_configured",
      "Webbi's AI isn't connected yet. Add ANTHROPIC_API_KEY to the server environment.",
    );
  }
  client ??= new Anthropic({ apiKey, maxRetries: 2, timeout: 90_000 });
  return client;
}

function wrap(error: unknown): never {
  if (error instanceof AiError) throw error;
  if (error instanceof Anthropic.APIError) {
    console.error("[ai] anthropic error", error.status, error.message);
    if (error.status === 401) throw new AiError("ai_not_configured", "The AI key was rejected. Check ANTHROPIC_API_KEY.");
    if (error.status === 429) throw new AiError("rate_limited", "Webbi is busy right now. Try again in a minute.");
    throw new AiError("provider_error", "Webbi couldn't reach its AI. Please try again.");
  }
  console.error("[ai] unexpected", error);
  throw new AiError("provider_error", "Webbi couldn't build this right now. Please try again.");
}

export const anthropicProvider: AiProvider = {
  name: "anthropic",

  async understand({ description }: UnderstandRequest): Promise<AiUnderstanding> {
    try {
      const response = await getClient().messages.parse({
        model: serverEnv.anthropicModel,
        max_tokens: 2048,
        system: UNDERSTAND_SYSTEM,
        messages: [{ role: "user", content: `DESCRIPTION:\n${description.trim()}` }],
        output_config: { format: zodOutputFormat(aiUnderstandingSchema) },
      });
      if (!response.parsed_output) throw new AiError("bad_output", "Webbi couldn't read that. Try adding a little more detail.");
      return response.parsed_output;
    } catch (error) {
      wrap(error);
    }
  },

  async generate(request: GenerateRequest): Promise<AiSite> {
    try {
      const response = await getClient().messages.parse({
        model: serverEnv.anthropicModel,
        max_tokens: 8192,
        system: GENERATE_SYSTEM,
        messages: [{ role: "user", content: buildGenerateUserMessage(request) }],
        output_config: { format: zodOutputFormat(aiSiteSchema) },
      });
      if (!response.parsed_output) throw new AiError("bad_output", "The draft came back incomplete. Please try again.");
      return response.parsed_output;
    } catch (error) {
      wrap(error);
    }
  },
};
