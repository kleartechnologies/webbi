import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handleApiError } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/verify";
import { createDraftSite } from "@/lib/site/drafts";
import { understandingSchema } from "@/lib/site/schema";

export const runtime = "nodejs";
export const maxDuration = 15;

const bodySchema = z.object({
  sourceDescription: z.string().trim().min(12).max(4000),
  /** Only from pages loaded before the description was read after creation (POST /api/ai/understand). */
  understanding: understandingSchema.optional(),
});

/**
 * Starts a new website for the signed-in account. The owner, status, payment
 * fields and quota all come from the server: the browser only sends the
 * description. 409 while the account already has an unpublished website; 429
 * once it has started the day's limit.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (user.isAnonymous) {
      return apiError(403, "forbidden", "Create an account before you start a website.");
    }
    const input = bodySchema.parse(await request.json().catch(() => null));
    const siteId = await createDraftSite(user.uid, input);
    return NextResponse.json({ siteId }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
