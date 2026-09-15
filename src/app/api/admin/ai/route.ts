import { handleApiError } from "@/lib/api/http";
import { aiUsage } from "@/lib/admin/ai";
import { requireAdmin } from "@/lib/admin/auth";
import { adminJson } from "@/lib/admin/dto";
import { emptyQuery, searchParamsOf } from "@/lib/admin/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request, "ai");
    emptyQuery.parse(searchParamsOf(request));
    return adminJson(await aiUsage());
  } catch (error) {
    return handleApiError(error);
  }
}
