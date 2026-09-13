/**
 * Client-side access for sites. Reads and draft edits run under firestore.rules,
 * so a user can only ever see and change their own sites. Starting and deleting
 * a website go through the server, which allows one unpublished website per
 * account (src/lib/site/drafts.ts); the rules refuse both from the browser.
 */
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { callApi } from "@/lib/api/client";
import { getClientDb } from "@/lib/firebase/client";
import type { Understanding } from "./schema";
import type { Site, SiteDoc } from "./types";

const SITES = "sites";

function toSite(snap: QueryDocumentSnapshot<DocumentData>): Site {
  return { id: snap.id, ...(snap.data() as SiteDoc) };
}

/**
 * Starts a website for the signed-in account. Throws an ApiError with status 409
 * (and details.existingSiteId) when one is already in progress, or 429 past the
 * day's limit.
 */
export async function createSite(input: { sourceDescription: string; understanding: Understanding }): Promise<string> {
  const { siteId } = await callApi<{ siteId: string }>("/api/sites", input);
  return siteId;
}

/** Fields an owner may change directly (mirrors firestore.rules). */
export type SiteOwnerPatch = Partial<
  Pick<SiteDoc, "draft" | "sourceDescription" | "generation" | "language">
>;

export async function updateSite(siteId: string, patch: SiteOwnerPatch): Promise<void> {
  await updateDoc(doc(getClientDb(), SITES, siteId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function getSite(siteId: string): Promise<Site | null> {
  const snap = await getDoc(doc(getClientDb(), SITES, siteId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as SiteDoc) };
}

export function subscribeSite(
  siteId: string,
  onChange: (site: Site | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getClientDb(), SITES, siteId),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...(snap.data() as SiteDoc) } : null),
    onError,
  );
}

export function subscribeUserSites(
  ownerUid: string,
  onChange: (sites: Site[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getClientDb(), SITES),
    where("ownerUid", "==", ownerUid),
    orderBy("updatedAt", "desc"),
  );
  return onSnapshot(q, (snap) => onChange(snap.docs.map(toSite)), onError);
}

/** Drafts only — the server refuses to delete a paid or published site. */
export async function deleteDraftSite(siteId: string): Promise<void> {
  await callApi<{ deleted: true }>("/api/sites/delete", { siteId });
}
