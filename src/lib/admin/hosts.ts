/**
 * Where Webbi's owner-only admin panel may be served. Kept free of "@/" imports
 * so the proxy (src/proxy.ts), route guards and tests share one definition, and
 * so a future custom-domain proxy can ask the same question: a customer's
 * domain is never an admin host, so customer-domain.com/admin and /api/admin
 * stay not-found whatever else that proxy does.
 *
 * This is not authorization. requireAdmin() (src/lib/admin/auth.ts) repeats the
 * host check and then verifies the owner itself on every request.
 *
 *   ADMIN_HOSTS          comma-separated hostnames. Default: webbi.online.
 *                        Outside production localhost and 127.0.0.1 are added.
 *   ADMIN_PANEL_ENABLED  "false" switches every admin page and API to 404.
 */

export const DEFAULT_ADMIN_HOSTS = ["webbi.online"] as const;

/** The paths the admin panel owns. Everything under them is gated. */
export const ADMIN_PAGE_PREFIX = "/admin";
export const ADMIN_API_PREFIX = "/api/admin";

const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

type Env = Record<string, string | undefined>;

const isProduction = (env: Env) => env.NODE_ENV === "production";

/** "Webbi.Online:443" → "webbi.online". Anything that isn't a plain hostname is null. */
export function normalizeHost(value: string | null | undefined): string | null {
  if (!value) return null;
  const host = value.trim().toLowerCase().replace(/:\d{1,5}$/, "").replace(/\.$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(host) ? host : null;
}

export function adminHosts(env: Env = process.env): string[] {
  const configured = (env.ADMIN_HOSTS ?? "")
    .split(",")
    .map((host) => normalizeHost(host))
    .filter((host): host is string => Boolean(host));
  const hosts = new Set<string>(configured.length ? configured : DEFAULT_ADMIN_HOSTS);
  if (!isProduction(env)) for (const host of LOCAL_HOSTS) hosts.add(host);
  return [...hosts];
}

/**
 * True only for a configured admin host. In production the Netlify fallback
 * (*.netlify.app) and local hosts are refused even if someone lists them.
 */
export function isAdminHost(value: string | null | undefined, env: Env = process.env): boolean {
  const host = normalizeHost(value);
  if (!host) return false;
  if (isProduction(env) && (host.endsWith(".netlify.app") || LOCAL_HOSTS.includes(host))) return false;
  return adminHosts(env).includes(host);
}

/** The kill switch: on unless ADMIN_PANEL_ENABLED says false. */
export function adminPanelEnabled(env: Env = process.env): boolean {
  const value = env.ADMIN_PANEL_ENABLED?.trim().toLowerCase();
  return !(value === "false" || value === "0" || value === "off");
}

export function isAdminPath(pathname: string): boolean {
  return [ADMIN_PAGE_PREFIX, ADMIN_API_PREFIX].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
