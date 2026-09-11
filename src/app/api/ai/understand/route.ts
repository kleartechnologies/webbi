import { NextResponse } from "next/server";
import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { toUnderstanding } from "@/lib/ai/assemble";
import { assertRateLimit, handleApiError } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/verify";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ description: z.string().trim().min(12).max(4000) });

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    assertRateLimit(`understand:${user.uid}`, 8, 10 * 60_000);
    const { description } = bodySchema.parse(await request.json());
    const raw = await getAiProvider().understand({ description });
    const understanding = toUnderstanding(raw);
    return NextResponse.json({ understanding });
  } catch (error) {
    return handleApiError(error);
  }
}
