import { NextResponse } from "next/server";
import { z } from "zod";
import { assertRateLimit, handleApiError } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/verify";
import { isPaymentConfigured } from "@/lib/payments";
import { checkSlug, getOwnedSite } from "@/lib/site/publish";

export const runtime = "nodejs";
export const maxDuration = 15;

const bodySchema = z.object({
  siteId: z.string().min(1).max(64),
  slug: z.string().trim().toLowerCase().min(1).max(60),
});

/** Is this link free? Read-only; the link is only claimed when payment is verified. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    assertRateLimit(`slug:${user.uid}`, 60, 60_000);
    const { siteId, slug } = bodySchema.parse(await request.json());
    await getOwnedSite(siteId, user.uid);
    const check = await checkSlug(slug, siteId);
    return NextResponse.json({ ...check, paymentsConfigured: isPaymentConfigured() });
  } catch (error) {
    return handleApiError(error);
  }
}
