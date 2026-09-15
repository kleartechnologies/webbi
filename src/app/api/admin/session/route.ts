import { handleApiError } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { recordAdminSession } from "@/lib/admin/audit";
import { adminJson } from "@/lib/admin/dto";
import { ADMIN_MAX_SIGN_IN_AGE_SECONDS } from "@/lib/admin/policy";
import { emptyQuery, searchParamsOf } from "@/lib/admin/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether the caller is the owner. The panel opens only after this answers 200; anyone else gets 404. */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request, "session");
    emptyQuery.parse(searchParamsOf(request));
    await recordAdminSession(admin.uid, admin.authTime);
    return adminJson({
      uid: admin.uid,
      email: admin.email,
      signInExpiresAt: new Date((admin.authTime + ADMIN_MAX_SIGN_IN_AGE_SECONDS) * 1000).toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
