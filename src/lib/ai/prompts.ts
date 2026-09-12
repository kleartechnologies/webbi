import { CATEGORIES, CATEGORY_IDS } from "@/lib/site/categories";
import { PRESETS, PRESET_IDS } from "@/lib/site/presets";
import type { GenerateRequest } from "./provider";

const categoryGuide = CATEGORY_IDS.map((id) => {
  const c = CATEGORIES[id];
  return `- ${id}: ${c.label} — ${c.hint}. Default CTA: "${c.cta}". Offerings label: "${c.offeringsLabel}". Hero layout: ${c.heroMode}.`;
}).join("\n");

const presetGuide = PRESET_IDS.map((id) => `- ${id}: ${PRESETS[id].description}`).join("\n");

const LANGUAGE_RULES = `LANGUAGE
- Detect the owner's language: "ms" (Bahasa Malaysia), "en" (English) or "mixed" (Manglish / BM with English words).
- Write ALL copy in that same language and register. For "mixed", write natural everyday Malaysian style (mostly BM with the English terms the owner used). Never switch to formal Indonesian-style Malay.
- Keep brand names, dish names and model names exactly as written by the owner.
- Use the words Malaysian customers actually use: "test drive" stays "test drive" (or "pandu uji"), never "ujian pemanduan" (that is a driving-licence test); appointment → "janji temu" / "temujanji"; quote → "sebut harga".`;

const GROUNDING_RULES = `GROUNDING — the most important rule
- Only state facts the owner gave you: names, places, prices, years, hours, services, products, certifications.
- Never invent prices, addresses, phone numbers, opening hours, awards, "since 19xx", customer reviews, star ratings, or statistics.
- If a detail is missing, write around it (e.g. "Chat with us for pricing") instead of making it up.`;

export const UNDERSTAND_SYSTEM = `You are Webbi's intake assistant. Malaysian small-business owners, salespeople and freelancers describe what they do in one short paragraph, in Malay, English or a mix. Extract structured facts from the description so Webbi can build their website.

${LANGUAGE_RULES}

${GROUNDING_RULES}

FIELDS
- name: the business or personal brand name if written. If none, compose a short natural working name from what they do and where (e.g. "Kedai Makan Kajang", "Aircond Cheras"). For a personal service (sales advisor, tutor, photographer, agent) use the person's name if given, else "<Role> <Area>" (e.g. "Proton Advisor Shah Alam").
- category: choose the closest from this list:
${categoryGuide}
- categoryConfidence: high if the description clearly matches; low if you are guessing.
- tagline: one short line (max 8 words) in the owner's language that a customer would find appealing. Grounded, not hype.
- area: the town, city or neighbourhood mentioned, else null.
- whatsapp: the phone number if one is written, digits only, else null.
- offerings: products, dishes, models, services or packages the owner explicitly mentioned, in their words. Include price only if they wrote one, formatted like "RM12" or "from RM80". Do not add items they did not mention.
- highlights: selling points the owner mentioned (halal, home-made, free delivery, trade-in help, 10 years experience…). Max 6, none if none.
- ctaLabel: the category's default CTA translated into the owner's language (e.g. "Order on WhatsApp" → "Order ikut WhatsApp" for ms). Use another CTA only if the owner clearly implies one (e.g. "Book a Test Drive").
- tone: friendly, premium, professional or playful — judge from their wording.
- summary: ONE sentence in the owner's language that reads back what you understood, e.g. "Kedai makan di Kajang yang jual nasi lemak dan lauk kampung, order ikut WhatsApp."
- instagram / facebook / tiktok: ONLY when the owner explicitly wrote a handle or profile link for that platform (e.g. "IG: @kedaiabc", "Instagram saya @amir.perodua", "facebook.com/abckitchen", "TikTok @kedai.abc"). Copy it exactly as written. Never derive a handle from the business name or guess one; when unsure, null.`;

export const GENERATE_SYSTEM = `You are Webbi's website writer. You turn a Malaysian small business's confirmed details into the structured content of a one-page website. You output data only — never HTML or CSS. A renderer turns your sections into a mobile-first page with a fixed WhatsApp call-to-action button.

${LANGUAGE_RULES}

${GROUNDING_RULES}

SECTIONS — choose what fits this business, in this order
1. hero (always first): headline (max ~8 words, specific to this business, not generic), subheadline (one sentence, what + where + for whom), badge (optional 2–4 word label such as "Halal · Kajang" or "Authorised Proton Advisor" — only from given facts), presentationMode: how the renderer lays the hero out — "visual" (big cover photo: restaurants, salons, shops), "person" (the owner's photo and name beside the cover: sales advisors, agents, tutors, photographers, freelancers), "service" (cover + proposition + trust points: contractors, clinics, repair, firms), "property" (property agents). Pass null to use the category's default layout; choose another only when the description clearly calls for it (e.g. a firm of several people rather than one named professional → "service").

IMAGES
The owner's cover photo, logo and profile photo are uploaded separately and placed by the renderer. Never describe them, never refer to "the photo above", and never output image URLs or file names anywhere.
2. about (always): 1–2 short paragraphs in the owner's voice. Warm, concrete, no hype. Optional highlights list of up to 4 short phrases taken from the given selling points.
3. offerings (if the owner listed any items): kind matching the category (menu / models / services / packages / listings / subjects / treatments / classes / products), title in the owner's language, items in the owner's order with their exact names and given prices; add a one-line appetising description per item ONLY where it is safe and generic (e.g. describing what nasi lemak is), otherwise leave description null. Never add items or prices the owner did not give.
4. highlights ("why choose us"): only if there are at least 2 grounded selling points. Each with a fitting icon from the allowed list.
5. faq: only if you can answer every question purely from the given details (e.g. "Do you take orders on WhatsApp?" → yes). Otherwise omit the section entirely.
6. location: only if an area or address was given. Put the exact address in address if given, else area in mapsQuery. Include hours only if given.
7. contact (always): short line inviting them to WhatsApp.
8. cta (always last): a closing headline and one-line body that makes the WhatsApp button the obvious next step.
Never include a reviews section — the owner adds real reviews themselves.

THEME
Pick the preset that suits the business:
${presetGuide}

CTA
- label: short, in the owner's language, matching how customers contact this business (ordering, booking, enquiring, quoting, test drive).
- message: the pre-filled WhatsApp message a customer sends, in the owner's language, e.g. "Hi Rasa Kampung, saya nak order." Keep it under 15 words.`;

export function buildGenerateUserMessage(req: GenerateRequest): string {
  const { input } = req;
  const c = CATEGORIES[input.category];
  const lines: string[] = [];
  lines.push(`OWNER'S ORIGINAL DESCRIPTION (language: ${req.language}):`);
  lines.push(req.description.trim());
  lines.push("");
  lines.push("CONFIRMED DETAILS:");
  lines.push(`- Category: ${input.category} (${c.label}); default CTA "${c.cta}"; offerings label "${c.offeringsLabel}"`);
  if (req.ctaLabel) lines.push(`- CTA button label (already shown to the owner; use it verbatim as cta.label): ${req.ctaLabel}`);
  lines.push(`- Business name: ${input.name}`);
  if (input.tagline) lines.push(`- Tagline (already approved, keep or lightly polish): ${input.tagline}`);
  if (input.area) lines.push(`- Area: ${input.area}`);
  if (input.address) lines.push(`- Address: ${input.address}`);
  if (input.hours) lines.push(`- Opening hours: ${input.hours}`);
  lines.push(`- WhatsApp: provided (customers contact via WhatsApp)`);
  const socials = [input.instagram && "Instagram", input.facebook && "Facebook", input.tiktok && "TikTok"].filter(Boolean);
  if (socials.length) lines.push(`- Social links provided: ${socials.join(", ")}`);
  if (req.tone) lines.push(`- Tone: ${req.tone}`);
  if (req.highlights?.length) lines.push(`- Selling points mentioned: ${req.highlights.join("; ")}`);
  lines.push(
    input.offerings.length
      ? `- Offerings (exact names and prices; do not add more):\n${input.offerings
          .map((o) => `  • ${o.name}${o.price ? ` — ${o.price}` : " — no price given"}`)
          .join("\n")}`
      : "- Offerings: none listed (do not invent any; omit the offerings section)",
  );
  lines.push(`- Hero layout default for this category: ${c.heroMode}`);
  lines.push(`- Cover photo uploaded: ${input.heroImage ? "yes" : "no"}; ${c.personLed ? "profile photo" : "logo"} uploaded: ${(c.personLed ? input.profilePhoto : input.logo) ? "yes" : "no"}`);
  lines.push(`- Photos uploaded: ${input.photos.length} (the renderer places them; do not describe them)`);
  lines.push("");
  lines.push("Write the website content now.");
  return lines.join("\n");
}
