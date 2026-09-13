import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/verify";
import { storeSiteImage } from "@/lib/images/storage";
import { SITE_ID } from "@/lib/site/drafts";
import { PublishError } from "@/lib/site/publish";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Stores one photo for a website: POST /api/sites/images?siteId=… with the
 * image bytes as the body. Returns { url, path, width, height }. The server
 * picks the file name and folder; see src/lib/images/storage.ts.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const siteId = new URL(request.url).searchParams.get("siteId") ?? "";
    if (!SITE_ID.test(siteId)) throw new PublishError("bad_request", "That website address isn't valid.");
    const image = await storeSiteImage(user, siteId, request);
    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
