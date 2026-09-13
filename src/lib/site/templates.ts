import { getCategory } from "./categories";
import { PRESET_IDS, type PresetId } from "./presets";

/**
 * A site's template is the presentation it renders with: Bright, Trust, Bold,
 * Elegant or Warm. It is stored as `theme.preset` in the site content, so it
 * travels with the draft, is copied to the live site on publish like every
 * other edit, and never touches the business content, AI, payment or slug.
 */
export type TemplateId = PresetId;

export const TEMPLATE_IDS = PRESET_IDS;

/** Used when a site has no usable template and no category to suggest one. */
export const DEFAULT_TEMPLATE_ID: TemplateId = "trust";

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && (TEMPLATE_IDS as readonly string[]).includes(value);
}

/**
 * The template a site renders with: its own choice when valid, otherwise the
 * one its category suggests, otherwise the default. Older or hand-edited
 * content therefore always renders, never with an error.
 */
export function resolveTemplateId(site: { theme?: { preset?: unknown } | null; business?: { category?: unknown } | null } | null | undefined): TemplateId {
  const chosen = site?.theme?.preset;
  if (isTemplateId(chosen)) return chosen;
  const category = site?.business?.category;
  if (typeof category === "string") {
    const suggested = getCategory(category).preset;
    if (isTemplateId(suggested)) return suggested;
  }
  return DEFAULT_TEMPLATE_ID;
}

/**
 * The editor's template switch: a copy of the content with only `theme.preset`
 * changed. Words, photos, sections, accent and CTA are untouched, and nothing
 * here reaches AI, payment, the slug or the live site (publishing copies the
 * draft later, like any other edit). An unknown id leaves the content as it is.
 */
export function switchTemplate<T extends { theme: { preset: PresetId } }>(site: T, id: unknown): T {
  if (!isTemplateId(id) || site.theme.preset === id) return site;
  return { ...site, theme: { ...site.theme, preset: id } };
}
