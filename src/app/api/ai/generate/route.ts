import { NextResponse } from "next/server";
import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { assembleSite } from "@/lib/ai/assemble";
import { AiError } from "@/lib/ai/errors";
import { assertRateLimit, handleApiError } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/verify";
import { LANGUAGES, generationInputSchema } from "@/lib/site/schema";

export const runtime = "nodejs";
// Netlify caps synchronous functions at 60 s; the OpenAI adapter keeps its own deadline inside that.
export const maxDuration = 60;

const bodySchema = z.object({
  description: z.string().trim().min(12).max(4000),
  language: z.enum(LANGUAGES),
  tone: z.enum(["friendly", "premium", "professional", "playful"]).optional(),
  highlights: z.array(z.string().max(80)).max(6).optional(),
  ctaLabel: z.string().trim().min(1).max(40).optional(),
  input: generationInputSchema,
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    assertRateLimit(`generate:${user.uid}`, 5, 10 * 60_000);
    const body = bodySchema.parse(await request.json());
    // Uploaded photos must belong to the caller — never let a URL for someone else's file in.
    const foreign = [...body.input.photos, ...body.input.offerings.map((o) => o.image)].find(
      (img) => img?.path && !img.path.startsWith(`users/${user.uid}/`),
    );
    if (foreign) throw new AiError("bad_output", "One of the photos doesn't belong to this account.");

    const provider = getAiProvider();
    let site;
    try {
      site = assembleSite(await provider.generate(body), body.input, body.language, body.ctaLabel);
    } catch (error) {
      // One retry on malformed output; model output is non-deterministic.
      if (error instanceof AiError) throw error;
      console.warn("[ai] assemble failed, retrying once", error);
      site = assembleSite(await provider.generate(body), body.input, body.language, body.ctaLabel);
    }
    return NextResponse.json({ site, model: provider.name });
  } catch (error) {
    return handleApiError(error);
  }
}
