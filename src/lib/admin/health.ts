import "server-only";

import { aiGlobalLimits } from "@/lib/ai/guard";
import { identityToolkit } from "@/lib/auth/accounts";
import { serverEnv } from "@/lib/env";
import { adminDb, adminStorage, isAdminConfigured } from "@/lib/firebase/admin";
import { appCheckMode } from "@/lib/security/appCheck";
import { adminPanelEnabled } from "./hosts";
import type { SystemCheck } from "./schemas";

/**
 * What the System page can honestly say. Firestore and Firebase Auth are
 * checked on every load, Storage at most every 5 minutes, OpenAI and Billplz
 * only when the owner presses "Run check". Netlify is not monitored from here.
 * A result is a state, a latency and a fixed sentence: never a response body,
 * a key, a URL or an upstream error message.
 */

export type ServiceState = "ok" | "error" | "not_configured" | "not_checked" | "not_monitored";

export interface ServiceStatus {
  id: "firestore" | "auth" | "storage" | "openai" | "billplz" | "netlify";
  label: string;
  state: ServiceState;
  latencyMs: number | null;
  checkedAt: string | null;
  detail: string;
  checkable: boolean;
}

export interface ConfigItem {
  key: string;
  label: string;
  value: boolean | string;
}

export interface SystemStatus {
  services: ServiceStatus[];
  configuration: ConfigItem[];
}

const CHECK_TIMEOUT_MS = 8_000;
const STORAGE_TTL_MS = 5 * 60 * 1000;

let storageCache: { status: ServiceStatus; at: number } | null = null;

async function timed(
  id: ServiceStatus["id"],
  label: string,
  run: () => Promise<boolean>,
  details: { ok: string; error: string },
  checkable = false,
): Promise<ServiceStatus> {
  const started = Date.now();
  let ok = false;
  try {
    ok = await run();
  } catch {
    ok = false;
  }
  return {
    id,
    label,
    state: ok ? "ok" : "error",
    latencyMs: Date.now() - started,
    checkedAt: new Date().toISOString(),
    detail: ok ? details.ok : details.error,
    checkable,
  };
}

function notConfigured(id: ServiceStatus["id"], label: string, detail: string, checkable = true): ServiceStatus {
  return { id, label, state: "not_configured", latencyMs: null, checkedAt: null, detail, checkable };
}

function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(CHECK_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function checkFirestore(): Promise<ServiceStatus> {
  return timed("firestore", "Firestore", async () => {
    await adminDb().doc("adminMetrics/overview").get();
    return true;
  }, { ok: "Read succeeded.", error: "Read failed." });
}

function checkAuth(): Promise<ServiceStatus> {
  return timed("auth", "Firebase Auth", async () => {
    await identityToolkit(":batchGet", { method: "GET", query: { maxResults: "1" } });
    return true;
  }, { ok: "Account lookup succeeded.", error: "Account lookup failed." });
}

async function checkStorage(force: boolean): Promise<ServiceStatus> {
  if (!force && storageCache && Date.now() - storageCache.at < STORAGE_TTL_MS) return storageCache.status;
  const status = await timed("storage", "Cloud Storage", async () => {
    await adminStorage().bucket().getFiles({ maxResults: 1, autoPaginate: false });
    return true;
  }, { ok: "Listing succeeded.", error: "Listing failed." }, true);
  storageCache = { status, at: Date.now() };
  return status;
}

function openAiStatus(): ServiceStatus {
  if (!serverEnv.openaiApiKey) return notConfigured("openai", "OpenAI", "No API key set.");
  return { id: "openai", label: "OpenAI", state: "not_checked", latencyMs: null, checkedAt: null, detail: "Checked only when you ask.", checkable: true };
}

function billplzReady(): boolean {
  return Boolean(serverEnv.billplzSecretKey && serverEnv.billplzCollectionId && serverEnv.billplzXSignatureKey);
}

function billplzStatus(): ServiceStatus {
  if (!billplzReady()) return notConfigured("billplz", "Billplz", "Not fully configured.");
  return { id: "billplz", label: "Billplz", state: "not_checked", latencyMs: null, checkedAt: null, detail: "Checked only when you ask.", checkable: true };
}

function netlifyStatus(): ServiceStatus {
  return {
    id: "netlify",
    label: "Netlify",
    state: "not_monitored",
    latencyMs: null,
    checkedAt: null,
    detail: "Not actively monitored. Use the Netlify dashboard for deploys and function logs.",
    checkable: false,
  };
}

async function checkOpenAi(): Promise<ServiceStatus> {
  const key = serverEnv.openaiApiKey;
  if (!key) return openAiStatus();
  return timed("openai", "OpenAI", async () => {
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(serverEnv.openaiModel)}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: withTimeout(),
    });
    await response.body?.cancel();
    return response.ok;
  }, { ok: "The API key works and the configured model is available.", error: "The API key or the configured model was refused, or OpenAI didn't answer." }, true);
}

async function checkBillplz(): Promise<ServiceStatus> {
  const secretKey = serverEnv.billplzSecretKey;
  const collectionId = serverEnv.billplzCollectionId;
  if (!secretKey || !collectionId || !billplzReady()) return billplzStatus();
  return timed("billplz", "Billplz", async () => {
    const response = await fetch(`${serverEnv.billplzBaseUrl}/v3/collections/${encodeURIComponent(collectionId)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}` },
      cache: "no-store",
      redirect: "manual",
      signal: withTimeout(),
    });
    await response.body?.cancel();
    return response.ok;
  }, { ok: "The secret key works and the collection exists.", error: "The secret key or collection was refused, or Billplz didn't answer." }, true);
}

function configuration(): ConfigItem[] {
  const limits = aiGlobalLimits();
  const clientAppCheck = Boolean(process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY?.trim());
  const context = process.env.CONTEXT?.trim();
  return [
    { key: "firebaseAdmin", label: "Firebase Admin credentials", value: isAdminConfigured() },
    { key: "openaiKey", label: "OpenAI API key", value: Boolean(serverEnv.openaiApiKey) },
    { key: "paymentProvider", label: "Payment provider", value: serverEnv.paymentProvider },
    { key: "billplz", label: "Billplz keys (secret, collection, X Signature)", value: billplzReady() },
    { key: "billplzSandbox", label: "Billplz sandbox", value: /billplz-sandbox\.com/i.test(serverEnv.billplzBaseUrl) ? "Yes (sandbox)" : "No (production API)" },
    { key: "appCheckMode", label: "App Check mode", value: appCheckMode() },
    { key: "appCheckSiteKey", label: "App Check site key (browser)", value: clientAppCheck },
    { key: "aiDailyBudget", label: "AI daily budget", value: limits.daily > 0 ? String(limits.daily) : "Off" },
    { key: "aiMonthlyBudget", label: "AI monthly budget", value: limits.monthly > 0 ? String(limits.monthly) : "Off" },
    { key: "adminHosts", label: "ADMIN_HOSTS", value: Boolean(process.env.ADMIN_HOSTS?.trim()) },
    { key: "adminPanel", label: "Admin panel enabled", value: adminPanelEnabled() },
    { key: "deployContext", label: "Deploy context", value: context || "Local" },
  ];
}

export async function systemStatus(): Promise<SystemStatus> {
  const [firestore, auth, storage] = await Promise.all([checkFirestore(), checkAuth(), checkStorage(false)]);
  return {
    services: [firestore, auth, storage, openAiStatus(), billplzStatus(), netlifyStatus()],
    configuration: configuration(),
  };
}

export function runSystemCheck(service: SystemCheck): Promise<ServiceStatus> {
  if (service === "openai") return checkOpenAi();
  if (service === "billplz") return checkBillplz();
  return checkStorage(true);
}
