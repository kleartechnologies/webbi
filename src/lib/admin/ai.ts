import "server-only";
import { AI_DAILY_LIMIT, AI_MONTHLY_LIMIT, AI_SITE_LIMIT, aiGlobalLimits } from "@/lib/ai/guard";
import { adminDb } from "@/lib/firebase/admin";
import { quotaDay } from "@/lib/site/drafts";
import { toSiteRowDto } from "./dto";
import { emailsFor } from "./users";
import { isoTime, quotaMonth, recentQuotaDays, recentQuotaMonths } from "./time";

/**
 * AI usage as Webbi counts it: accepted requests (failed ones included) from
 * aiBudget, userQuotas and siteAi. No prompt, request or response is stored
 * anywhere, so none can be shown. Provider cost isn't tracked, so none is shown.
 */

export const AI_USAGE_NOTE = "Request count (includes failed requests). Provider cost: not tracked.";

export function remaining(count: number, limit: number): number | null {
  return limit > 0 ? Math.max(0, limit - count) : null;
}

const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const SITE_NAME_FIELDS = ["draft.business.name", "published.business.name"];

export async function aiUsage(now = new Date()) {
  const db = adminDb();
  const day = quotaDay(now);
  const month = quotaMonth(now);
  const days = recentQuotaDays(14, now);
  const months = recentQuotaMonths(6, now);
  const limits = aiGlobalLimits();

  const [budgetSnaps, usersToday, usersMonth, topSites, recentSites] = await Promise.all([
    db.getAll(...days.map((d) => db.doc(`aiBudget/day-${d}`)), ...months.map((m) => db.doc(`aiBudget/month-${m}`))),
    db.collection("userQuotas").where("aiDay", "==", day).orderBy("aiRequestsToday", "desc").select("aiRequestsToday").limit(10).get(),
    db.collection("userQuotas").where("aiMonth", "==", month).orderBy("aiRequestsThisMonth", "desc").select("aiRequestsThisMonth").limit(10).get(),
    db.collection("siteAi").orderBy("generations", "desc").select("ownerUid", "understandings", "generations", "updatedAt").limit(10).get(),
    db.collection("siteAi").orderBy("updatedAt", "desc").select("ownerUid", "understandings", "generations", "updatedAt").limit(20).get(),
  ]);
  const budget = new Map(budgetSnaps.map((snap) => [snap.id, count(snap.get("count"))]));
  const siteDocs = [...topSites.docs, ...recentSites.docs];
  const siteIds = [...new Set(siteDocs.map((doc) => doc.id))];
  const [emails, names] = await Promise.all([
    emailsFor([...usersToday.docs, ...usersMonth.docs].map((doc) => doc.id).concat(siteDocs.map((doc) => doc.get("ownerUid")))),
    siteIds.length ? db.getAll(...siteIds.map((id) => db.doc(`sites/${id}`)), { fieldMask: SITE_NAME_FIELDS }) : Promise.resolve([]),
  ]);
  const nameOf = new Map(names.filter((snap) => snap.exists).map((snap) => [snap.id, toSiteRowDto(snap.id, snap.data() ?? {}).businessName]));
  const siteRow = (doc: (typeof siteDocs)[number]) => ({
    siteId: doc.id,
    businessName: nameOf.get(doc.id) ?? null,
    ownerUid: typeof doc.get("ownerUid") === "string" ? (doc.get("ownerUid") as string) : null,
    ownerEmail: emails.get(doc.get("ownerUid")) ?? null,
    understandings: count(doc.get("understandings")),
    generations: count(doc.get("generations")),
    updatedAt: isoTime(doc.get("updatedAt")),
  });
  const today = budget.get(`day-${day}`) ?? 0;
  const thisMonth = budget.get(`month-${month}`) ?? 0;

  return {
    note: AI_USAGE_NOTE,
    today: { day, requests: today, limit: limits.daily, remaining: remaining(today, limits.daily) },
    month: { month, requests: thisMonth, limit: limits.monthly, remaining: remaining(thisMonth, limits.monthly) },
    accountLimits: { daily: AI_DAILY_LIMIT, monthly: AI_MONTHLY_LIMIT },
    siteLimits: AI_SITE_LIMIT,
    daily: days.map((d) => ({ day: d, requests: budget.get(`day-${d}`) ?? 0 })),
    monthly: months.map((m) => ({ month: m, requests: budget.get(`month-${m}`) ?? 0 })),
    topAccountsToday: usersToday.docs.map((doc) => ({ uid: doc.id, email: emails.get(doc.id) ?? null, requests: count(doc.get("aiRequestsToday")) })),
    topAccountsThisMonth: usersMonth.docs.map((doc) => ({ uid: doc.id, email: emails.get(doc.id) ?? null, requests: count(doc.get("aiRequestsThisMonth")) })),
    topSites: topSites.docs.map(siteRow),
    recentSites: recentSites.docs.map(siteRow),
  };
}
