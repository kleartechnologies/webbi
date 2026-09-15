import { assertRateLimit, handleApiError } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { adminJson } from "@/lib/admin/dto";
import { runSystemCheck } from "@/lib/admin/health";
import { emptyQuery, searchParamsOf, systemCheckBody } from "@/lib/admin/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One on-demand check of openai, billplz or storage. Never a URL; the result is only ok, status and latency. */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request, "system.check");
    emptyQuery.parse(searchParamsOf(request));
    const { service } = systemCheckBody.parse(await request.json().catch(() => null));
    assertRateLimit(`admin-check:${admin.uid}`, 10, 60_000);
    return adminJson(await runSystemCheck(service));
  } catch (error) {
    return handleApiError(error);
  }
}
