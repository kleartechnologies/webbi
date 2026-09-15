import "server-only";
import type { DocumentData, Query, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { AdminBadRequestError } from "./errors";

/**
 * One page of a Firestore query, continued after the document named by
 * `cursor` (its id in `collection`). Reads limit + 1 documents to know whether
 * there is a next page; a cursor that names no document is a 400.
 */
export async function queryPage(
  query: Query<DocumentData>,
  collection: string,
  cursor: string | undefined,
  limit: number,
): Promise<{ docs: QueryDocumentSnapshot<DocumentData>[]; nextCursor: string | null }> {
  let paged = query;
  if (cursor) {
    const after = await adminDb().collection(collection).doc(cursor).get();
    if (!after.exists) throw new AdminBadRequestError("That page no longer exists. Start from the first page.");
    paged = paged.startAfter(after);
  }
  const snap = await paged.limit(limit + 1).get();
  const docs = snap.docs.slice(0, limit);
  return { docs, nextCursor: snap.docs.length > limit ? docs[docs.length - 1].id : null };
}

export function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
