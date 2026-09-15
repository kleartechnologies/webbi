import { apiError, handleApiError } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { adminJson } from "@/lib/admin/dto";
import { emptyQuery, searchParamsOf, uidParam } from "@/lib/admin/schemas";
import { userDetail } from "@/lib/admin/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  try {
    await requireAdmin(request, "users.detail");
    emptyQuery.parse(searchParamsOf(request));
    const uid = uidParam.parse((await params).uid);
    const detail = await userDetail(uid);
    if (!detail) return apiError(404, "not_found", "Not found.");
    return adminJson(detail);
  } catch (error) {
    return handleApiError(error);
  }
}
