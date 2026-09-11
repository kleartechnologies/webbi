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
