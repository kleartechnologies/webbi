import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/verify";
import { deleteDraftSite, SITE_ID } from "@/lib/site/drafts";

export const runtime = "nodejs";
export const maxDuration = 15;

const bodySchema = z.object({ siteId: z.string().regex(SITE_ID) });

/** Deletes the owner's unpaid draft and frees their unpublished-website slot. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const { siteId } = bodySchema.parse(await request.json().catch(() => null));
    await deleteDraftSite(user.uid, siteId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
