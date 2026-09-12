import { mapsEmbedUrl, mapsUrl } from "./links";

/**
 * Where a site's location section points. Built from whatever the owner gave:
 * a full address when there is one, otherwise the Maps query the AI kept or
 * the area served. Nothing is guessed — an area-only site links to a Maps
 * search for that area and says so by not showing an address line.
 */
export interface LocationTarget {
  /** Text shown on the site: the address, or the area/query when there is none. */
  label: string;
  /** True when `label` is a street address rather than an area or search text. */
  precise: boolean;
  /** Cleaned text sent to Google Maps. */
  query: string;
  /** "Open in Google Maps" destination (a Maps search for `query`). */
  href: string;
  /** Keyless Google Maps embed for the same query. */
  embedSrc: string;
}

const MAX_QUERY = 240;

const clean = (value: string | undefined | null): string | undefined => {
  const text = value?.replace(/\s+/g, " ").trim();
  return text ? text : undefined;
};

/**
 * Turn owner-written location text into a Maps search: drop asides in
 * brackets ("(near Amerin Mall)"), stray punctuation and repeated spaces.
 * Falls back to the plain trimmed text when stripping would leave nothing.
 */
export function mapsQueryText(text: string): string {
  const plain = clean(text) ?? "";
  const stripped = clean(
    plain
      .replace(/[([{][^)\]}]*[)\]}]/g, " ")
      .replace(/\s*,\s*,+/g, ",")
      .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, ""),
  );
  return (stripped ?? plain).slice(0, MAX_QUERY);
}

export function resolveLocation(
  section: { address?: string; mapsQuery?: string } | undefined,
  business: { address?: string; area?: string },
): LocationTarget | null {
  const address = clean(section?.address) ?? clean(business.address);
  const fallback = clean(section?.mapsQuery) ?? clean(business.area);
  const label = address ?? fallback;
  if (!label) return null;
  const query = mapsQueryText(label);
  if (!query) return null;
  return { label, precise: Boolean(address), query, href: mapsUrl(query), embedSrc: mapsEmbedUrl(query) };
}
