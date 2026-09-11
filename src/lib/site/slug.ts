/** URL slug from a business name: "Rasa Kampung Café" → "rasa-kampung-cafe". */
export function slugify(input: string, max = 40): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}
