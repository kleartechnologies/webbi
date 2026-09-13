import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/auth/verify";
import { AiError, AiQuotaError } from "@/lib/ai/errors";
import { AdminNotConfiguredError } from "@/lib/firebase/admin";
import { UploadError } from "@/lib/images/storage";
import { PaymentError } from "@/lib/payments/provider";
import { DraftLimitError } from "@/lib/site/drafts";
import { PublishError } from "@/lib/site/publish";

export type ApiErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "bad_request"
  | "payload_too_large"
  | "unsupported_media_type"
  | "rate_limited"
  | "ai_not_configured"
  | "ai_failed"
  | "payments_not_configured"
  | "payment_failed"
  | "admin_not_configured"
  | "internal";

export function apiError(status: number, code: ApiErrorCode, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/** Maps thrown errors to a consistent JSON error body. */
export function handleApiError(error: unknown) {
  if (error instanceof UnauthorizedError) return apiError(401, "unauthenticated", error.message);
  if (error instanceof ZodError) {
    return apiError(400, "bad_request", "Some of the details sent were invalid. Go back and check them.");
  }
  if (error instanceof AiQuotaError) {
    if (error.reason === "busy") return apiError(409, "conflict", error.message, { reason: error.reason });
    return apiError(429, "rate_limited", error.message, { reason: error.reason });
  }
  if (error instanceof AiError) {
    if (error.code === "ai_not_configured") {
      // The adapter's message names server settings: it belongs in the logs, not in a response.
      console.error("[ai] not available:", error.message);
      return apiError(503, "ai_not_configured", "Webbi's AI isn't available right now. Please try again later.");
    }
    if (error.code === "rate_limited") return apiError(429, "rate_limited", error.message);
    return apiError(502, "ai_failed", error.message);
  }
  if (error instanceof UploadError) {
    if (error.code === "too_large") return apiError(413, "payload_too_large", error.message);
    if (error.code === "unsupported_type") return apiError(415, "unsupported_media_type", error.message);
    return apiError(429, "rate_limited", error.message, { reason: error.code });
  }
  if (error instanceof DraftLimitError) {
    if (error.code === "daily_limit") return apiError(429, "rate_limited", error.message);
    return apiError(409, "conflict", error.message, { existingSiteId: error.existingSiteId });
  }
  if (error instanceof PublishError) {
    const status = { not_found: 404, forbidden: 403, conflict: 409, bad_request: 400 }[error.code];
    return apiError(status, error.code, error.message);
  }
  if (error instanceof PaymentError) {
    if (error.code === "payments_not_configured") return apiError(503, "payments_not_configured", error.message);
    if (error.code === "not_found") return apiError(404, "not_found", error.message);
    if (error.code === "bad_signature") return apiError(400, "bad_request", error.message);
    return apiError(502, "payment_failed", error.message);
  }
  if (error instanceof AdminNotConfiguredError) {
    console.error("[api] admin not configured");
    return apiError(
      503,
      "admin_not_configured",
      "Publishing isn't switched on for this deployment yet. The server needs its Firebase service account (see README).",
    );
  }
  console.error("[api] unhandled", error);
  return apiError(500, "internal", "Something went wrong on our side. Please try again.");
}

/**
 * Small in-memory limiter. Serverless instances don't share memory, so this
 * is a soft cap against accidental loops rather than a security control.
 */
const buckets = new Map<string, number[]>();

export function assertRateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    throw new AiError("rate_limited", "You're going a bit fast. Wait a minute and try again.");
  }
  hits.push(now);
  buckets.set(key, hits);
}
