import "server-only";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { storedSiteContentSchema } from "./schema";

/**
 * Read side of publishing. Live sites are stored at publicSites/{slug}, which
 * the Firestore rules make world-readable, so the public page can fetch them
 * over the Firestore REST API with the web API key — no Admin SDK, no service
 * account, and Next's fetch cache keeps it fast (revalidated every minute and
 * on publish via revalidateTag).
 */
const publicSiteSchema = z.object({
  siteId: z.string().min(1),
  slug: z.string().min(1),
  // A live site whose template is missing or unknown still renders, with its category's template.
  content: storedSiteContentSchema,
  publishedAt: z.string().optional(),
});
export type PublicSite = z.infer<typeof publicSiteSchema>;

/** A link whose website Webbi has taken down. Carries nothing else on purpose. */
export interface SuspendedPublicSite {
  suspended: true;
}

export function siteCacheTag(slug: string): string {
  return `site:${slug}`;
}

function firestoreBase(): string {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulator && process.env.NODE_ENV !== "production") return `http://${emulator}/v1`;
  return "https://firestore.googleapis.com/v1";
}

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { arrayValue: { values?: FirestoreValue[] } };

function decode(value: FirestoreValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("mapValue" in value) return decodeFields(value.mapValue.fields ?? {});
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decode);
  return undefined;
}

function decodeFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) out[key] = decode(value);
  return out;
}

/** The live site for a slug, a suspension marker, or null when nothing is published there. */
export async function getPublicSite(slug: string): Promise<PublicSite | SuspendedPublicSite | null> {
  const { projectId, apiKey } = publicEnv.firebase;
  const url = `${firestoreBase()}/projects/${projectId}/databases/(default)/documents/publicSites/${encodeURIComponent(slug)}?key=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 60, tags: [siteCacheTag(slug)] } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Could not load site "${slug}" (Firestore ${res.status})`);
  const doc = (await res.json()) as { fields?: Record<string, FirestoreValue> };
  const fields = decodeFields(doc.fields ?? {});
  // Checked before anything else: a suspended link never renders content, whatever else the document holds.
  if (fields.suspended !== undefined && fields.suspended !== false) return { suspended: true };
  const parsed = publicSiteSchema.safeParse(fields);
  if (!parsed.success) {
    console.error(`publicSites/${slug} failed validation`, parsed.error.issues.slice(0, 3));
    return null;
  }
  return parsed.data;
}
