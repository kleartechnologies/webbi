import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRateLimit, handleApiError } from "@/lib/api/http";
import { assertMayPublish } from "@/lib/auth/publishing";
import { requireUser } from "@/lib/auth/verify";
import { republishSite } from "@/lib/site/publish";

export const runtime = "nodejs";
export const maxDuration = 15;

const bodySchema = z.object({ siteId: z.string().min(1).max(64) });

/** Pushes the owner's latest edits to an already-paid live site. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    assertRateLimit(`republish:${user.uid}`, 30, 10 * 60_000);
    assertMayPublish(user);
    const { siteId } = bodySchema.parse(await request.json());
    const { slug } = await republishSite(siteId, user.uid);
    return NextResponse.json({ status: "published", slug });
  } catch (error) {
    return handleApiError(error);
  }
}
