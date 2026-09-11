import "server-only";
import { anthropicProvider } from "./anthropic";
import { mockProvider } from "./mock";
import type { AiProvider } from "./provider";

/** AI_PROVIDER=anthropic (default) | mock (development only). */
export function getAiProvider(): AiProvider {
  const name = process.env.AI_PROVIDER || "anthropic";
  if (name === "mock") return mockProvider;
  return anthropicProvider;
}

export type { AiProvider, GenerateRequest, UnderstandRequest } from "./provider";
