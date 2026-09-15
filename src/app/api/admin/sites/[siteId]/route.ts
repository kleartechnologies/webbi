import { apiError, handleApiError } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { adminJson } from "@/lib/admin/dto";
import { searchParamsOf, siteDetailQuery, siteIdParam } from "@/lib/admin/schemas";
import { siteDetail, siteStorage } from "@/lib/admin/sites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One website's facts; ?section=storage counts its stored images instead (loaded on demand). */
export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    await requireAdmin(request, "sites.detail");
    const query = siteDetailQuery.parse(searchParamsOf(request));
    const siteId = siteIdParam.parse((await params).siteId);
    if (query.section === "storage") {
      const storage = await siteStorage(siteId);
      if (!storage) return apiError(404, "not_found", "Not found.");
      return adminJson({ storage });
    }
    const detail = await siteDetail(siteId);
    if (!detail) return apiError(404, "not_found", "Not found.");
    return adminJson(detail);
  } catch (error) {
    return handleApiError(error);
  }
}
