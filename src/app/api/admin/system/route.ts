import { handleApiError } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { adminJson } from "@/lib/admin/dto";
import { systemStatus } from "@/lib/admin/health";
import { emptyQuery, searchParamsOf } from "@/lib/admin/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Firestore, Firebase Auth and (cached) Storage checks, plus configuration as booleans. OpenAI and Billplz only on demand. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request, "system");
    emptyQuery.parse(searchParamsOf(request));
    return adminJson(await systemStatus());
  } catch (error) {
    return handleApiError(error);
  }
}
