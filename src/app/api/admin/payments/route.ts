import { handleApiError } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { adminJson } from "@/lib/admin/dto";
import { listPayments } from "@/lib/admin/payments";
import { paymentsQuery, searchParamsOf } from "@/lib/admin/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request, "payments");
    const query = paymentsQuery.parse(searchParamsOf(request));
    return adminJson(await listPayments(query));
  } catch (error) {
    return handleApiError(error);
  }
}
