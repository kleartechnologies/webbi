/** Display helpers for the admin panel. Dates are shown in Malaysia time, like the quotas count. */

const DATE_TIME = new Intl.DateTimeFormat("en-MY", {
  timeZone: "Asia/Kuala_Lumpur",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const EMPTY = "—";

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? DATE_TIME.format(date) : EMPTY;
}

export function formatCount(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-MY") : EMPTY;
}

export function formatSen(sen: number | null | undefined): string {
  if (typeof sen !== "number" || !Number.isFinite(sen)) return EMPTY;
  return `RM${(sen / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "3 of 10", or "3 (no limit)" when the limit is switched off (0). */
export function formatAgainstLimit(count: number, limit: number): string {
  return limit > 0 ? `${formatCount(count)} of ${formatCount(limit)}` : `${formatCount(count)} (no limit)`;
}

const PROVIDERS: Record<string, string> = { "google.com": "Google", password: "Email", phone: "Phone" };

export function providerLabel(id: string): string {
  return PROVIDERS[id] ?? id;
}
