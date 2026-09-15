import "server-only";
import { AggregateField, FieldValue, Timestamp, type Query } from "firebase-admin/firestore";
import { aiGlobalLimits } from "@/lib/ai/guard";
import { adminDb } from "@/lib/firebase/admin";
import { quotaDay } from "@/lib/site/drafts";
import type { PaymentAttentionReason } from "@/lib/site/types";
import { remaining } from "./ai";
import { REFUND_REASONS } from "./dto";
import { authAccountsPage } from "./users";
import { DAY_MS, isoTime, malaysiaDayStart, millis, quotaMonth } from "./time";

/**
 * The admin overview, computed with count/sum aggregates in parallel and kept
 * in adminMetrics/overview (server only). Opening the panel reads that snapshot;
 * it is recomputed when older than OVERVIEW_TTL_MS, or on a manual refresh at
 * most once per OVERVIEW_REFRESH_COOLDOWN_MS.
 */

export const OVERVIEW_TTL_MS = 5 * 60_000;
export const OVERVIEW_REFRESH_COOLDOWN_MS = 60_000;
/** Firebase Auth has no count: accounts are paged through, up to this many. */
export const USER_SCAN_LIMIT = 10_000;
const USER_PAGE = 1000;

export const REVENUE_NOTE = "Collected per Webbi's records. Refunds are handled outside Webbi and are not deducted.";

export interface OverviewData {
  day: string;
  users: {
    total: number;
    newToday: number;
    new7Days: number;
    new30Days: number;
    verified: number;
    google: number;
    emailPassword: number;
    disabled: number;
    /** More accounts exist than were counted (USER_SCAN_LIMIT). */
    capped: boolean;
  };
  websites: { total: number; drafts: number; live: number; createdToday: number; publishedToday: number };
  revenue: {
    note: string;
    paidOrders: number;
    collectedTodaySen: number;
    collected7DaysSen: number;
    collected30DaysSen: number;
    collectedAllTimeSen: number;
    pendingBills: number;
    pendingOver24h: number;
    paidNotLive: number;
    needsAttention: number;
    needsRefund: number;
  };
  ai: {
    note: string;
    day: string;
    today: number;
    dailyLimit: number;
    dailyRemaining: number | null;
    month: string;
    thisMonth: number;
    monthlyLimit: number;
    monthlyRemaining: number | null;
  };
  moderation: {
    suspended: number;
    active: number;
    latest: { siteId: string; suspendedAt: string | null }[];
  };
}

const counted = async (query: Query) => (await query.count().get()).data().count;
const summed = async (query: Query, field: string) => {
  const snap = await query.aggregate({ total: AggregateField.sum(field) }).get();
  const total = snap.data().total;
  return typeof total === "number" && Number.isFinite(total) ? total : 0;
};

async function userStats(now: Date): Promise<OverviewData["users"]> {
  const stats: OverviewData["users"] = { total: 0, newToday: 0, new7Days: 0, new30Days: 0, verified: 0, google: 0, emailPassword: 0, disabled: 0, capped: false };
  const today = malaysiaDayStart(now).getTime();
  const week = today - 6 * DAY_MS;
  const month = today - 29 * DAY_MS;
  let cursor: string | undefined;
  do {
    const page = await authAccountsPage(USER_PAGE, cursor);
    for (const user of page.users) {
      stats.total += 1;
      const created = Number(user.createdAt) || 0;
      if (created >= today) stats.newToday += 1;
      if (created >= week) stats.new7Days += 1;
      if (created >= month) stats.new30Days += 1;
      if (user.emailVerified) stats.verified += 1;
      if (user.disabled) stats.disabled += 1;
      const providers = (user.providerUserInfo ?? []).map((info) => info.providerId);
      if (providers.includes("google.com")) stats.google += 1;
      if (providers.includes("password")) stats.emailPassword += 1;
    }
    cursor = page.nextCursor ?? undefined;
    if (cursor && stats.total >= USER_SCAN_LIMIT) {
      stats.capped = true;
      break;
    }
  } while (cursor);
  return stats;
}

export async function computeOverview(now = new Date()): Promise<OverviewData> {
  const db = adminDb();
  const sites = db.collection("sites");
  const payments = db.collection("payments");
  const moderation = db.collection("siteModeration");
  const paid = payments.where("status", "==", "paid");
  const pending = payments.where("status", "==", "pending");
  const today = Timestamp.fromDate(malaysiaDayStart(now));
  const since = (days: number) => Timestamp.fromDate(malaysiaDayStart(now, days));
  const day = quotaDay(now);
  const month = quotaMonth(now);
  const limits = aiGlobalLimits();

  const [
    users,
    siteTotal,
    drafts,
    live,
    createdToday,
    publishedToday,
    paidOrders,
    collectedToday,
    collected7,
    collected30,
    collectedAll,
    pendingBills,
    pendingOld,
    attention,
    [dayBudget, monthBudget],
    suspended,
    latest,
  ] = await Promise.all([
    userStats(now),
    counted(sites),
    counted(sites.where("status", "==", "draft")),
    counted(sites.where("status", "==", "published")),
    counted(sites.where("createdAt", ">=", today)),
    counted(sites.where("publishedAt", ">=", today)),
    counted(paid),
    summed(paid.where("paidAt", ">=", today), "paidAmountSen"),
    summed(paid.where("paidAt", ">=", since(6)), "paidAmountSen"),
    summed(paid.where("paidAt", ">=", since(29)), "paidAmountSen"),
    summed(paid, "paidAmountSen"),
    counted(pending),
    counted(pending.where("createdAt", "<", Timestamp.fromMillis(now.getTime() - DAY_MS))),
    payments.where("needsAttention", "==", true).select("attentionReason").limit(1000).get(),
    db.getAll(db.doc(`aiBudget/day-${day}`), db.doc(`aiBudget/month-${month}`)),
    counted(moderation.where("moderationStatus", "==", "suspended")),
    moderation.where("moderationStatus", "==", "suspended").orderBy("suspendedAt", "desc").select("suspendedAt").limit(5).get(),
  ]);

  const reasons = attention.docs.map((doc) => doc.get("attentionReason") as PaymentAttentionReason | null);
  const needsRefund = reasons.filter((reason) => reason && REFUND_REASONS.includes(reason)).length;
  const aiToday = Number(dayBudget.get("count")) || 0;
  const aiMonth = Number(monthBudget.get("count")) || 0;

  return {
    day,
    users,
    websites: { total: siteTotal, drafts, live, createdToday, publishedToday },
    revenue: {
      note: REVENUE_NOTE,
      paidOrders,
      collectedTodaySen: collectedToday,
      collected7DaysSen: collected7,
      collected30DaysSen: collected30,
      collectedAllTimeSen: collectedAll,
      pendingBills,
      pendingOver24h: pendingOld,
      paidNotLive: reasons.length - needsRefund,
      needsAttention: reasons.length,
      needsRefund,
    },
    ai: {
      note: "Request count (includes failed requests). Provider cost: not tracked.",
      day,
      today: aiToday,
      dailyLimit: limits.daily,
      dailyRemaining: remaining(aiToday, limits.daily),
      month,
      thisMonth: aiMonth,
      monthlyLimit: limits.monthly,
      monthlyRemaining: remaining(aiMonth, limits.monthly),
    },
    moderation: {
      suspended,
      active: Math.max(0, siteTotal - suspended),
      latest: latest.docs.map((doc) => ({ siteId: doc.id, suspendedAt: isoTime(doc.get("suspendedAt")) })),
    },
  };
}

export interface OverviewSnapshot {
  data: OverviewData;
  computedAt: string;
  /** When a manual refresh is next allowed. */
  refreshAvailableAt: string;
  refreshed: boolean;
}

let computing: Promise<OverviewSnapshot> | null = null;

export async function getOverview(options: { refresh?: boolean; now?: Date } = {}): Promise<OverviewSnapshot> {
  const now = options.now ?? new Date();
  const ref = adminDb().doc("adminMetrics/overview");
  const snap = await ref.get();
  const computedMs = millis(snap.get("computedAt"));
  const age = now.getTime() - computedMs;
  const cached = snap.exists ? (snap.get("data") as OverviewData | undefined) : undefined;
  const wanted = !cached || age >= OVERVIEW_TTL_MS || (options.refresh === true && age >= OVERVIEW_REFRESH_COOLDOWN_MS);
  if (cached && !wanted) {
    return {
      data: cached,
      computedAt: new Date(computedMs).toISOString(),
      refreshAvailableAt: new Date(computedMs + OVERVIEW_REFRESH_COOLDOWN_MS).toISOString(),
      refreshed: false,
    };
  }
  computing ??= (async () => {
    try {
      const data = await computeOverview(now);
      await ref.set({ data, computedAt: FieldValue.serverTimestamp(), version: 1 });
      return {
        data,
        computedAt: now.toISOString(),
        refreshAvailableAt: new Date(now.getTime() + OVERVIEW_REFRESH_COOLDOWN_MS).toISOString(),
        refreshed: true,
      };
    } finally {
      computing = null;
    }
  })();
  return computing;
}
