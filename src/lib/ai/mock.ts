import "server-only";
import { CATEGORIES } from "@/lib/site/categories";
import { AiError } from "./errors";
import type { AiProvider, GenerateRequest, UnderstandRequest } from "./provider";
import type { AiSite, AiUnderstanding } from "./schemas";

/**
 * Development-only provider (AI_PROVIDER=mock). It never runs in production
 * and never pretends to understand anything: it copies the owner's words into
 * the structure so the rest of the flow (Firestore, editor, renderer, publish)
 * can be exercised without an API key.
 */
async function guard(kind: "understand" | "generate") {
  if (process.env.NODE_ENV === "production") {
    throw new AiError("ai_not_configured", "The mock AI provider is disabled in production.");
  }
  // Simulate latency so the Generating screen behaves like the real thing.
  const delay = Number(process.env.AI_MOCK_DELAY_MS ?? (kind === "generate" ? 4000 : 800));
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));
}

function detectLanguage(text: string): "en" | "ms" | "mixed" {
  const ms = (text.match(/\b(saya|kami|kedai|jual|dan|di|buka|harga|servis|area|nak|boleh|untuk|dengan)\b/gi) ?? []).length;
  const en = (text.match(/\b(the|and|we|our|i'm|i am|with|for|in|at|help|free)\b/gi) ?? []).length;
  if (ms && en) return "mixed";
  return ms > en ? "ms" : "en";
}

export const mockProvider: AiProvider = {
  name: "mock",

  async understand({ description }: UnderstandRequest): Promise<AiUnderstanding> {
    await guard("understand");
    const text = description.trim();
    const lower = text.toLowerCase();
    const category = /makan|restoran|cafe|kafe|nasi|food|restaurant|catering|kuih/.test(lower)
      ? "restaurant"
      : /proton|perodua|toyota|honda|car|kereta|sales advisor|test drive/.test(lower)
        ? "car"
        : /aircond|plumb|renovat|wiring|electric|paip|contractor/.test(lower)
          ? "homeServices"
          : /photo|gambar|wedding/.test(lower)
            ? "photographer"
            : /tuition|tutor|kelas|class/.test(lower)
              ? "tutor"
              : /salon|spa|makeup|beauty|kecantikan/.test(lower)
                ? "beauty"
                : /property|hartanah|real estate|negotiator|condo|rumah|agent/.test(lower)
                  ? "property"
                  : "other";
    const areaMatch = text.match(/\b(?:di|in|area|around)\s+([A-Z][\w']+(?:\s+[A-Z][\w']+)?)/);
    const phone = text.match(/(?:\+?60|0)1\d[\s-]?\d{3,4}[\s-]?\d{4}/)?.[0]?.replace(/\D/g, "") ?? null;
    const items = text
      .split(/[,.;]|\bdan\b|\band\b/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 2 && s.length < 40 && !/^(saya|i|we|customer)/i.test(s))
      .slice(1, 5);
    return {
      language: detectLanguage(text),
      name: `${CATEGORIES[category].label} ${areaMatch?.[1] ?? ""}`.trim(),
      category,
      categoryConfidence: "low",
      tagline: null,
      area: areaMatch?.[1] ?? null,
      whatsapp: phone,
      offerings: items.map((name) => ({ name, price: null })),
      highlights: [],
      ctaLabel: CATEGORIES[category].cta,
      tone: "friendly",
      summary: `[mock] ${text.slice(0, 120)}`,
    };
  },

  async generate(req: GenerateRequest): Promise<AiSite> {
    await guard("generate");
    const { input } = req;
    const c = CATEGORIES[input.category];
    const sections: AiSite["sections"] = [
      { type: "hero", headline: input.name, subheadline: input.tagline ?? null, badge: input.area ?? null },
      { type: "about", title: null, body: [req.description.trim()], highlights: req.highlights?.length ? req.highlights : null },
    ];
    if (input.offerings.length) {
      sections.push({
        type: "offerings",
        kind: input.category === "restaurant" ? "menu" : input.category === "car" ? "models" : "services",
        title: c.offeringsLabel,
        note: null,
        items: input.offerings.map((o) => ({ name: o.name, description: null, price: o.price ?? null, tag: null })),
      });
    }
    if (input.area || input.address) {
      sections.push({
        type: "location",
        title: null,
        address: input.address ?? null,
        mapsQuery: input.address ?? input.area ?? null,
        hours: input.hours ? [{ days: "Hours", hours: input.hours }] : null,
        note: null,
      });
    }
    sections.push({ type: "contact", title: null, body: null });
    sections.push({ type: "cta", headline: `[mock] ${c.cta}`, body: null });
    return {
      language: req.language,
      business: { name: input.name, tagline: input.tagline ?? null, area: input.area ?? null },
      theme: { preset: c.preset },
      cta: { label: c.cta, message: null },
      sections,
    };
  },
};
