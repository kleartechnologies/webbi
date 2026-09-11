/**
 * Read world-readable Firestore documents over REST with the public web API
 * key. Used by the public renderer (/w/[slug]) so published sites can be
 * served (and cached by Next) without Admin credentials.
 */
import { publicEnv } from "@/lib/env";

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { referenceValue: string }
  | { geoPointValue: { latitude: number; longitude: number } };

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export function fromFirestoreValue(value: FirestoreValue): JsonValue {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("geoPointValue" in value) return { ...value.geoPointValue };
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(fromFirestoreValue);
  if ("mapValue" in value) return fromFirestoreFields(value.mapValue.fields ?? {});
  return null;
}

export function fromFirestoreFields(
  fields: Record<string, FirestoreValue>,
): { [key: string]: JsonValue } {
  const out: { [key: string]: JsonValue } = {};
  for (const [key, value] of Object.entries(fields)) out[key] = fromFirestoreValue(value);
  return out;
}

export interface PublicDocumentOptions {
  /** Next cache tags, so a publish can call revalidateTag(). */
  tags?: string[];
  /** Seconds before the cached copy is refreshed in the background. */
  revalidate?: number | false;
}

/**
 * Fetch a single document as plain JSON. Returns null when it does not exist
 * or when the rules deny public access.
 */
export async function getPublicDocument(
  collection: string,
  id: string,
  options: PublicDocumentOptions = {},
): Promise<{ [key: string]: JsonValue } | null> {
  const { projectId, apiKey } = publicEnv.firebase;
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/` +
    `${encodeURIComponent(collection)}/${encodeURIComponent(id)}?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    next: { tags: options.tags, revalidate: options.revalidate ?? 3600 },
  });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Firestore REST error ${res.status} for ${collection}/${id}`);
  const doc = (await res.json()) as { fields?: Record<string, FirestoreValue> };
  return fromFirestoreFields(doc.fields ?? {});
}
