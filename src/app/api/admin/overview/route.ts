import { handleApiError } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { adminJson } from "@/lib/admin/dto";
import { getOverview } from "@/lib/admin/metrics";
import { overviewQuery, searchParamsOf } from "@/lib/admin/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 26;

/** The overview snapshot: cached for 5 minutes; ?refresh=1 recomputes it at most once a minute. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request, "overview");
    const query = overviewQuery.parse(searchParamsOf(request));
    return adminJson(await getOverview({ refresh: query.refresh === "1" }));
  } catch (error) {
    return handleApiError(error);
  }
}
