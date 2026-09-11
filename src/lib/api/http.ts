import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/auth/verify";
import { AiError } from "@/lib/ai/errors";

export type ApiErrorCode =
  | "unauthenticated"
  | "bad_request"
  | "rate_limited"
  | "ai_not_configured"
  | "ai_failed"
  | "internal";

export function apiError(status: number, code: ApiErrorCode, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Maps thrown errors to a consistent JSON error body. */
export function handleApiError(error: unknown) {
  if (error instanceof UnauthorizedError) return apiError(401, "unauthenticated", error.message);
  if (error instanceof ZodError) {
    return apiError(400, "bad_request", "Some of the details sent were invalid. Go back and check them.");
  }
  if (error instanceof AiError) {
    if (error.code === "ai_not_configured") return apiError(503, "ai_not_configured", error.message);
    if (error.code === "rate_limited") return apiError(429, "rate_limited", error.message);
    return apiError(502, "ai_failed", error.message);
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
