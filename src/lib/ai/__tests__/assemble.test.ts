import { describe, expect, it } from "vitest";
import type { GenerationInput } from "@/lib/site/schema";
import { assembleSite, normalizeMyPhone } from "../assemble";
import { mockProvider } from "../mock";

describe("normalizeMyPhone", () => {
  it("turns common Malaysian formats into international digits", () => {
    expect(normalizeMyPhone("012-345 6789")).toBe("60123456789");
    expect(normalizeMyPhone("+60 12 345 6789")).toBe("60123456789");
    expect(normalizeMyPhone("60123456789")).toBe("60123456789");
    expect(normalizeMyPhone("123456789")).toBe("60123456789");
  });
  it("returns undefined for empty or nonsensical input", () => {
    expect(normalizeMyPhone("")).toBeUndefined();
    expect(normalizeMyPhone(null)).toBeUndefined();
    expect(normalizeMyPhone("call me")).toBeUndefined();
    expect(normalizeMyPhone("12")).toBeUndefined();
  });
});

describe("assembleSite", () => {
  const input: GenerationInput = { category: "car", name: "Amir", whatsapp: "60123456789", offerings: [], photos: [] };
  const req = { description: "Saya jual kereta Perodua dekat Balakong, WhatsApp untuk book test drive.", language: "ms" as const, input };

  it("keeps the CTA label from the understand step instead of the writer's re-translation", async () => {
    process.env.AI_MOCK_DELAY_MS = "0";
    const raw = await mockProvider.generate(req);
    expect(assembleSite(raw, input, "ms", "Tempah Test Drive").cta.label).toBe("Tempah Test Drive");
    expect(assembleSite(raw, input, "ms").cta.label).toBe(raw.cta.label);
    expect(assembleSite(raw, input, "ms", "   ").cta.label).toBe(raw.cta.label);
  });
});
