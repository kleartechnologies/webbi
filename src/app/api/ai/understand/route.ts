import { NextResponse } from "next/server";
import { z } from "zod";
import { toUnderstanding } from "@/lib/ai/assemble";
import { requireAiAccount, runAiJob, withoutError } from "@/lib/ai/guard";
import { assertRateLimit, handleApiError } from "@/lib/api/http";
import { SITE_ID } from "@/lib/site/drafts";
import { PublishError } from "@/lib/site/publish";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The browser names its website and nothing else: the description is read from the site. */
const bodySchema = z.object({ siteId: z.string().regex(SITE_ID) });
const descriptionSchema = z.string().trim().min(12).max(4000);

/**
 * Reads the description saved on the caller's own new website and saves what
 * was understood on the site. Limits, lock and counting: src/lib/ai/guard.ts.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAiAccount(request);
    const { siteId } = bodySchema.parse(await request.json().catch(() => null));
    // A soft cap per server instance; the real limits are in runAiJob.
    assertRateLimit(`understand:${user.uid}`, 8, 10 * 60_000);

    const understanding = await runAiJob({
      user,
      siteId,
      kind: "understand",
      prepare(site) {
        const status = site.generation?.status;
        if (status !== "understanding" && status !== "understood") {
          throw new PublishError("bad_request", "This website's description has already been read. Continue with your details.");
        }
        return { description: descriptionSchema.parse(site.sourceDescription) };
      },
      run: async (provider, body) => toUnderstanding(await provider.understand(body)),
      save: (result, site) => ({
        generation: { ...withoutError(site.generation), status: "understood", understanding: result },
        language: result.language,
      }),
    });
    return NextResponse.json({ understanding });
  } catch (error) {
    return handleApiError(error);
  }
}
