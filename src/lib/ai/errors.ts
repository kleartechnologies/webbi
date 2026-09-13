export type AiErrorCode = "ai_not_configured" | "rate_limited" | "bad_output" | "provider_error";

export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/** Why an AI request was refused before it reached the provider (src/lib/ai/guard.ts). */
export type AiQuotaReason = "busy" | "daily_limit" | "monthly_limit" | "site_limit";

const QUOTA_MESSAGES: Record<AiQuotaReason, string> = {
  busy: "You're generating too quickly. Please wait for the current generation to finish.",
  daily_limit: "Your AI generation limit has been reached for today. Please try again tomorrow.",
  monthly_limit: "Your AI generation limit has been reached for this month.",
  site_limit: "Your generation limit for this website has been reached.",
};

/** 409 when busy, 429 for every limit. Nothing was counted. */
export class AiQuotaError extends Error {
  constructor(public readonly reason: AiQuotaReason) {
    super(QUOTA_MESSAGES[reason]);
    this.name = "AiQuotaError";
  }
}
