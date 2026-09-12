import "server-only";
import { serverEnv } from "@/lib/env";
import { anthropicProvider } from "./anthropic";
import { mockProvider } from "./mock";
import { openaiProvider } from "./openai";
import type { AiProvider } from "./provider";

/**
 * AI_PROVIDER=openai | anthropic | mock (development only).
 * When unset, the provider is chosen from the key that is configured
 * (OPENAI_API_KEY first, then ANTHROPIC_API_KEY). With no key at all the
 * OpenAI adapter is returned so the error names OPENAI_API_KEY.
 */
export function getAiProvider(): AiProvider {
  const name = process.env.AI_PROVIDER;
  if (name === "mock") return mockProvider;
  if (name === "anthropic") return anthropicProvider;
  if (name === "openai") return openaiProvider;
  if (name) console.warn(`[ai] Unknown AI_PROVIDER "${name}"; choosing from configured keys instead.`);
  if (serverEnv.openaiApiKey) return openaiProvider;
  if (serverEnv.anthropicApiKey) return anthropicProvider;
  return openaiProvider;
}

export type { AiProvider, GenerateRequest, UnderstandRequest } from "./provider";
