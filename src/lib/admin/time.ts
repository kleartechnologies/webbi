import { quotaDay } from "@/lib/site/drafts";

/**
 * Malaysia calendar boundaries for the admin figures, the same days the quotas
 * count (quotaDay, Asia/Kuala_Lumpur). Malaysia has no daylight saving: UTC+8.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight in Malaysia at the start of the day `now` falls on, `daysBack` days earlier. */
export function malaysiaDayStart(now: Date = new Date(), daysBack = 0): Date {
  const start = new Date(`${quotaDay(now)}T00:00:00+08:00`);
  return new Date(start.getTime() - daysBack * DAY_MS);
}

/** YYYY-MM in Malaysia: the month the AI quotas count. */
export function quotaMonth(now: Date = new Date()): string {
  return quotaDay(now).slice(0, 7);
}

/** The Malaysia days ending today, newest first: ["2026-09-15", "2026-09-14", …]. */
export function recentQuotaDays(count: number, now: Date = new Date()): string[] {
  const today = malaysiaDayStart(now);
  return Array.from({ length: count }, (_, i) => quotaDay(new Date(today.getTime() - i * DAY_MS + DAY_MS / 2)));
}

/** The Malaysia months ending this month, newest first: ["2026-09", "2026-08", …]. */
export function recentQuotaMonths(count: number, now: Date = new Date()): string[] {
  const [year, month] = quotaMonth(now).split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1 - i, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/** A Firestore Timestamp, Date or millisecond value as an ISO string; anything else is null. */
export function isoTime(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const toDate = (value as { toDate?: () => Date }).toDate;
  const date =
    typeof toDate === "function"
      ? toDate.call(value)
      : value instanceof Date
        ? value
        : typeof value === "number" || (typeof value === "string" && /^\d{10,}$/.test(value))
          ? new Date(Number(value))
          : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function millis(value: unknown): number {
  const iso = isoTime(value);
  return iso ? Date.parse(iso) : 0;
}
