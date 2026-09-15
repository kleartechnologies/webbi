import { z } from "zod";

/**
 * Query and body validation for the admin API. Unknown parameters, a limit
 * over 50, an unknown filter or a malformed cursor are 400s, never ignored.
 */

export const ADMIN_PAGE_DEFAULT = 25;
export const ADMIN_PAGE_MAX = 50;

const limit = z.coerce.number().int().min(1).max(ADMIN_PAGE_MAX).default(ADMIN_PAGE_DEFAULT);
/** Firestore document ids used as cursors (site, payment, moderation). */
export const DOC_ID = /^[A-Za-z0-9_-]{1,128}$/;
/** Firebase Auth's opaque page token. */
const AUTH_PAGE_TOKEN = /^[A-Za-z0-9_\-.=:]{1,512}$/;
export const UID = /^[A-Za-z0-9_-]{1,128}$/;

export const overviewQuery = z.object({ refresh: z.enum(["1"]).optional() }).strict();

export const usersQuery = z
  .object({
    limit,
    cursor: z.string().regex(AUTH_PAGE_TOKEN).optional(),
    /** An exact email address or an exact uid. */
    q: z.string().trim().min(1).max(254).optional(),
  })
  .strict();

export const SITE_FILTERS = ["all", "draft", "published", "paid", "suspended", "payment_pending", "paid_not_live"] as const;
export type SiteFilter = (typeof SITE_FILTERS)[number];

export const sitesQuery = z
  .object({ limit, cursor: z.string().regex(DOC_ID).optional(), filter: z.enum(SITE_FILTERS).default("all") })
  .strict();

export const siteDetailQuery = z.object({ section: z.enum(["storage"]).optional() }).strict();

export const PAYMENT_VIEWS = ["recent", "paid", "pending", "failed", "attention", "refund"] as const;
export type PaymentView = (typeof PAYMENT_VIEWS)[number];

export const paymentsQuery = z
  .object({ limit, cursor: z.string().regex(DOC_ID).optional(), view: z.enum(PAYMENT_VIEWS).default("recent") })
  .strict();

export const moderationQuery = z.object({ limit, cursor: z.string().regex(DOC_ID).optional() }).strict();

export const emptyQuery = z.object({}).strict();

export const uidParam = z.string().regex(UID);
export const siteIdParam = z.string().regex(DOC_ID);

/** On-demand checks: exactly these services, never a URL. */
export const SYSTEM_CHECKS = ["openai", "billplz", "storage"] as const;
export type SystemCheck = (typeof SYSTEM_CHECKS)[number];
export const systemCheckBody = z.object({ service: z.enum(SYSTEM_CHECKS) }).strict();

/** The query string as an object. A repeated parameter is refused rather than silently collapsed. */
export function searchParamsOf(request: Request): Record<string, string> {
  const params = new URL(request.url).searchParams;
  const result: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in result) throw new z.ZodError([{ code: "custom", path: [key], message: "repeated parameter", input: value }]);
    result[key] = value;
  }
  return result;
}
