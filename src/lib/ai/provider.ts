import type { GenerationInput, Language } from "@/lib/site/schema";
import type { AiSite, AiUnderstanding } from "./schemas";

export interface UnderstandRequest {
  description: string;
}

export interface GenerateRequest {
  description: string;
  language: Language;
  input: GenerationInput;
  tone?: "friendly" | "premium" | "professional" | "playful";
  highlights?: string[];
  /** CTA label from the understand step (category default in the owner's language); reused verbatim. */
  ctaLabel?: string;
}

/** Boundary between Webbi and any LLM vendor. Implementations live next to this file. */
export interface AiProvider {
  readonly name: string;
  understand(request: UnderstandRequest): Promise<AiUnderstanding>;
  generate(request: GenerateRequest): Promise<AiSite>;
}
