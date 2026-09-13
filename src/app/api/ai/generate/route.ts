import { NextResponse } from "next/server";
import { z } from "zod";
import { assembleSite } from "@/lib/ai/assemble";
import { AiError } from "@/lib/ai/errors";
import { requireAiAccount, runAiJob, withoutError } from "@/lib/ai/guard";
import { assertRateLimit, handleApiError } from "@/lib/api/http";
import { foreignImage } from "@/lib/images/ownership";
import { SITE_ID } from "@/lib/site/drafts";
import { PublishError } from "@/lib/site/publish";
import { LANGUAGES, generationInputSchema } from "@/lib/site/schema";

export const runtime = "nodejs";
// Netlify caps synchronous functions at 60 s; the OpenAI adapter keeps its own deadline inside that.
export const maxDuration = 60;

/** The browser names its website and nothing else: every other field is ignored. */
const bodySchema = z.object({ siteId: z.string().regex(SITE_ID) });

/** The provider request, rebuilt from the stored site and checked exactly as before. */
const requestSchema = z.object({
  description: z.string().trim().min(12).max(4000),
  language: z.enum(LANGUAGES),
  tone: z.enum(["friendly", "premium", "professional", "playful"]).optional(),
  highlights: z.array(z.string().max(80)).max(6).optional(),
  ctaLabel: z.string().trim().min(1).max(40).optional(),
  input: generationInputSchema,
});

/**
 * Builds (or rebuilds) the draft of the caller's own website from the details
 * saved on it, and saves the result on the site. Limits, lock and counting:
 * src/lib/ai/guard.ts.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAiAccount(request);
    const { siteId } = bodySchema.parse(await request.json().catch(() => null));
    // A soft cap per server instance; the real limits are in runAiJob.
    assertRateLimit(`generate:${user.uid}`, 5, 10 * 60_000);

    const result = await runAiJob({
      user,
      siteId,
      kind: "generate",
      prepare(site) {
        const generation = site.generation;
        if (generation?.status !== "generating" || !generation.input) {
          throw new PublishError("bad_request", "Confirm your details before building your website.");
        }
        const understanding = generation.understanding;
        const body = requestSchema.parse({
          description: site.sourceDescription,
          language: site.language,
          tone: understanding?.tone,
          highlights: understanding?.highlights,
          // The understood CTA is the category default in the owner's language; only reuse it if they kept that category.
          ctaLabel: understanding?.category === generation.input.category ? understanding.ctaLabel : undefined,
          input: generation.input,
        });
        // Uploaded photos must belong to the caller: never let a URL for someone else's file in.
        if (foreignImage(user.uid, body.input)) {
          throw new PublishError("bad_request", "One of the photos doesn't belong to this account.");
        }
        return body;
      },
      async run(provider, body) {
        const build = async () => assembleSite(await provider.generate(body), body.input, body.language, body.ctaLabel);
        try {
          return { site: await build(), model: provider.name };
        } catch (error) {
          // One retry on malformed output; model output is non-deterministic.
          if (error instanceof AiError) throw error;
          console.warn("[ai] assemble failed, retrying once", error);
        }
        try {
          return { site: await build(), model: provider.name };
        } catch (error) {
          if (error instanceof AiError) throw error;
          console.error("[ai] assemble failed twice", error);
          throw new AiError("bad_output", "The website came back incomplete. Please try again.");
        }
      },
      save: ({ site: draft, model }, site) => ({
        draft,
        generation: { ...withoutError(site.generation), status: "ready", model },
      }),
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
