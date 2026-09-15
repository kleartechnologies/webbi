import "server-only";
import { AI_DAILY_LIMIT, AI_MONTHLY_LIMIT } from "@/lib/ai/guard";
import { identityToolkit, lookupRawAccounts, type RawAuthUser } from "@/lib/auth/accounts";
import { adminDb } from "@/lib/firebase/admin";
import { DAILY_UPLOAD_LIMIT } from "@/lib/images/storage";
import { quotaDay } from "@/lib/site/drafts";
import type { UserQuotaDoc } from "@/lib/site/types";
import {
  PAYMENT_FIELDS,
  SITE_ROW_FIELDS,
  toAccountDto,
  toPaymentDto,
  toSiteRowDto,
  type AdminAccountDto,
} from "./dto";
import { chunks } from "./paging";
import { UID } from "./schemas";
import { millis, quotaMonth } from "./time";

/**
 * Accounts come from Firebase Auth, the authority for who exists. The
 * users/{uid} profile documents are not used. Websites and payments are joined
 * in batches: two Firestore queries per 30 accounts, never one per account.
 */

interface BatchGetResponse {
  users?: RawAuthUser[];
  nextPageToken?: string;
}

/** One page of Firebase Auth accounts, in Firebase's own order. */
export async function authAccountsPage(limit: number, cursor?: string): Promise<{ users: RawAuthUser[]; nextCursor: string | null }> {
  const data = await identityToolkit<BatchGetResponse>(":batchGet", {
    method: "GET",
    query: { maxResults: String(limit), ...(cursor ? { nextPageToken: cursor } : {}) },
  });
  const users = data.users ?? [];
  return { users, nextCursor: users.length && data.nextPageToken ? data.nextPageToken : null };
}

/** Email addresses for uids, looked up 100 at a time. Unknown uids are absent. */
export async function emailsFor(uids: Iterable<string | null | undefined>): Promise<Map<string, string>> {
  const unique = [...new Set([...uids].filter((uid): uid is string => typeof uid === "string" && UID.test(uid)))];
  const emails = new Map<string, string>();
  const pages = await Promise.all(chunks(unique, 100).map((localId) => lookupRawAccounts({ localId })));
  for (const user of pages.flat()) if (user.localId && user.email) emails.set(user.localId, user.email);
  return emails;
}

export interface AccountTotals {
  websites: number;
  drafts: number;
  live: number;
  paidOrders: number;
  paidSen: number;
}

export async function accountTotals(uids: string[]): Promise<Map<string, AccountTotals>> {
  const totals = new Map<string, AccountTotals>(uids.map((uid) => [uid, { websites: 0, drafts: 0, live: 0, paidOrders: 0, paidSen: 0 }]));
  const db = adminDb();
  await Promise.all(
    chunks(uids, 30).flatMap((batch) => [
      db
        .collection("sites")
        .where("ownerUid", "in", batch)
        .select("ownerUid", "status")
        .get()
        .then((snap) => {
          for (const doc of snap.docs) {
            const entry = totals.get(doc.get("ownerUid"));
            if (!entry) continue;
            entry.websites += 1;
            if (doc.get("status") === "published") entry.live += 1;
            else entry.drafts += 1;
          }
        }),
      db
        .collection("payments")
        .where("ownerUid", "in", batch)
        .where("status", "==", "paid")
        .select("ownerUid", "amountSen", "paidAmountSen")
        .get()
        .then((snap) => {
          for (const doc of snap.docs) {
            const entry = totals.get(doc.get("ownerUid"));
            if (!entry) continue;
            entry.paidOrders += 1;
            entry.paidSen += paidSen(doc.get("paidAmountSen"), doc.get("amountSen"));
          }
        }),
    ]),
  );
  return totals;
}

export function paidSen(paidAmount: unknown, amount: unknown): number {
  if (typeof paidAmount === "number" && Number.isFinite(paidAmount)) return paidAmount;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
}

export type AdminUserRow = AdminAccountDto & AccountTotals;

export async function listUsers(input: { limit: number; cursor?: string; q?: string }): Promise<{ users: AdminUserRow[]; nextCursor: string | null }> {
  let raw: RawAuthUser[];
  let nextCursor: string | null = null;
  if (input.q) {
    const q = input.q.trim();
    if (q.includes("@")) raw = await lookupRawAccounts({ email: [q] });
    else if (UID.test(q)) raw = await lookupRawAccounts({ localId: [q] });
    else raw = [];
    // Exact matches only: Firebase compares emails case-insensitively, uids exactly.
    raw = raw.filter((user) => user.localId === q || user.email?.toLowerCase() === q.toLowerCase());
  } else {
    ({ users: raw, nextCursor } = await authAccountsPage(input.limit, input.cursor));
  }
  const accounts = raw.map(toAccountDto).filter((account) => account.uid);
  const totals = await accountTotals(accounts.map((account) => account.uid));
  return {
    users: accounts.map((account) => ({ ...account, ...totals.get(account.uid)! })),
    nextCursor,
  };
}

export async function userDetail(uid: string, now = new Date()) {
  const [raw] = (await lookupRawAccounts({ localId: [uid] })).filter((user) => user.localId === uid);
  if (!raw) return null;
  const db = adminDb();
  const [sites, payments, quotaSnap] = await Promise.all([
    db.collection("sites").where("ownerUid", "==", uid).select(...SITE_ROW_FIELDS).limit(50).get(),
    db.collection("payments").where("ownerUid", "==", uid).select(...PAYMENT_FIELDS).limit(100).get(),
    db.doc(`userQuotas/${uid}`).get(),
  ]);
  const account = toAccountDto(raw);
  const quota = (quotaSnap.data() ?? {}) as Partial<UserQuotaDoc>;
  const day = quotaDay(now);
  const month = quotaMonth(now);
  const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  return {
    account,
    websites: sites.docs
      .sort((a, b) => millis(b.get("updatedAt")) - millis(a.get("updatedAt")))
      .map((doc) => toSiteRowDto(doc.id, doc.data(), account.email)),
    payments: payments.docs
      .sort((a, b) => millis(b.get("createdAt")) - millis(a.get("createdAt")))
      .map((doc) => toPaymentDto(doc.id, doc.data(), account.email)),
    ai: {
      day,
      today: quota.aiDay === day ? count(quota.aiRequestsToday) : 0,
      dailyLimit: AI_DAILY_LIMIT,
      month,
      thisMonth: quota.aiMonth === month ? count(quota.aiRequestsThisMonth) : 0,
      monthlyLimit: AI_MONTHLY_LIMIT,
    },
    uploads: { day, today: quota.uploadsDay === day ? count(quota.uploadsToday) : 0, dailyLimit: DAILY_UPLOAD_LIMIT },
    openDraftSiteId: typeof quota.openDraftSiteId === "string" ? quota.openDraftSiteId : null,
  };
}
