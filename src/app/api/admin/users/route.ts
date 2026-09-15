import { handleApiError } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { adminJson } from "@/lib/admin/dto";
import { searchParamsOf, usersQuery } from "@/lib/admin/schemas";
import { listUsers } from "@/lib/admin/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Firebase Auth accounts, a page at a time, or one exact email or uid (?q=). */
export async function GET(request: Request) {
  try {
    await requireAdmin(request, "users");
    const query = usersQuery.parse(searchParamsOf(request));
    return adminJson(await listUsers(query));
  } catch (error) {
    return handleApiError(error);
  }
}
