import { NextResponse, type NextRequest } from "next/server";
import { adminPanelEnabled, isAdminHost } from "@/lib/admin/hosts";
import { ADMIN_HEADERS } from "@/lib/security/headers";

/**
 * Keeps the owner admin panel off every host but its own (ADMIN_HOSTS, default
 * webbi.online): the Netlify fallback and any customer domain get a plain
 * not-found for /admin and /api/admin, as does everyone while
 * ADMIN_PANEL_ENABLED=false.
 *
 * This is only the first fence. It authorizes nobody: every admin API route
 * calls requireAdmin() (src/lib/admin/auth.ts), which checks the host again
 * and then the owner's token, account and App Check itself.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  if (adminPanelEnabled() && isAdminHost(host)) return NextResponse.next();

  const response = request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json({ error: { code: "not_found", message: "Not found." } }, { status: 404 })
    : // A path that doesn't exist: the ordinary not-found page, with a 404.
      NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });
  for (const { key, value } of ADMIN_HEADERS) response.headers.set(key, value);
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin", "/api/admin/:path*"],
};
