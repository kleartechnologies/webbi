import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

/**
 * adminAuditLogs/{id}: server only (firestore.rules deny every browser).
 *
 *   ADMIN_SESSION_START   once per owner sign-in: session-{uid}-{authTime}
 *   ADMIN_ACCESS_DENIED   refusals after a valid token, one document per account
 *                         per UTC hour: denied-{uid}-{yyyymmddhh}, counted
 *
 * Only the uid, the reason, the route name and server timestamps are stored.
 * Never a token, password, IP address, request body or customer content.
 * Writing is best-effort: a failed audit write is logged and never changes the
 * answer the request gets.
 */

export type AdminDenyReason =
  | "no_role"
  | "email_unverified"
  | "provider"
  | "stale_sign_in"
  | "app_check"
  | "account_missing"
  | "account_disabled"
  | "role_revoked"
  | "session_revoked";

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_ROUTE = /^[a-z0-9_.-]{1,64}$/;

/** A soft cap on denial writes per server instance, so a flood of refused requests can't become a flood of writes. */
const DENIED_WRITES_PER_MINUTE = 60;
let deniedWindow = { start: 0, count: 0 };

function hourKey(now: Date): string {
  return now.toISOString().slice(0, 13).replace(/[-T]/g, "");
}

export async function recordAdminSession(uid: string, authTime: number): Promise<void> {
  if (!SAFE_ID.test(uid) || !Number.isInteger(authTime)) return;
  try {
    await adminDb()
      .doc(`adminAuditLogs/session-${uid}-${authTime}`)
      .create({ type: "ADMIN_SESSION_START", uid, authTime, at: FieldValue.serverTimestamp() });
  } catch (error) {
    // 6 = ALREADY_EXISTS: this sign-in was already recorded.
    if ((error as { code?: unknown })?.code === 6) return;
    console.error("[admin] couldn't record a session start", { error: error instanceof Error ? error.message : typeof error });
  }
}

export async function recordAdminDenied(uid: string, reason: AdminDenyReason, route: string, now = new Date()): Promise<void> {
  const minute = Math.floor(now.getTime() / 60_000);
  if (deniedWindow.start !== minute) deniedWindow = { start: minute, count: 0 };
  if (++deniedWindow.count > DENIED_WRITES_PER_MINUTE) return;

  const account = SAFE_ID.test(uid) ? uid : "invalid";
  const hour = hourKey(now);
  try {
    await adminDb()
      .doc(`adminAuditLogs/denied-${account}-${hour}`)
      .set(
        {
          type: "ADMIN_ACCESS_DENIED",
          uid: account,
          hour,
          count: FieldValue.increment(1),
          reasons: FieldValue.arrayUnion(reason),
          routes: FieldValue.arrayUnion(SAFE_ROUTE.test(route) ? route : "other"),
          lastAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  } catch (error) {
    console.error("[admin] couldn't record a refused admin request", { error: error instanceof Error ? error.message : typeof error });
  }
}
