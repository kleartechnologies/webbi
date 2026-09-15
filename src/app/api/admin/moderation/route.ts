import { handleApiError } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { adminJson } from "@/lib/admin/dto";
import { moderationList } from "@/lib/admin/moderation";
import { moderationQuery, searchParamsOf } from "@/lib/admin/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read only. Suspending and restoring stay with `npm run ops:moderate`. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request, "moderation");
    const query = moderationQuery.parse(searchParamsOf(request));
    return adminJson(await moderationList(query));
  } catch (error) {
    return handleApiError(error);
  }
}
