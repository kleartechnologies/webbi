import { handleApiError } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { adminJson } from "@/lib/admin/dto";
import { searchParamsOf, sitesQuery } from "@/lib/admin/schemas";
import { listSites } from "@/lib/admin/sites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request, "sites");
    const query = sitesQuery.parse(searchParamsOf(request));
    return adminJson(await listSites(query));
  } catch (error) {
    return handleApiError(error);
  }
}
