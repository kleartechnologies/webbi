/**
 * Client-side Firestore access for sites. Everything here runs under
 * firestore.rules, so a user can only ever see and change their own sites.
 */
import {
  addDoc,
  collection,
  deleteDoc,
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
import { getClientDb } from "@/lib/firebase/client";
import type { Language, SiteContent } from "./schema";
import type { GenerationState, Site, SiteDoc } from "./types";

const SITES = "sites";

function toSite(snap: QueryDocumentSnapshot<DocumentData>): Site {
  return { id: snap.id, ...(snap.data() as SiteDoc) };
}

export async function createSite(input: {
  ownerUid: string;
  sourceDescription: string;
  language: Language;
  generation?: GenerationState;
  draft?: SiteContent | null;
}): Promise<string> {
  const ref = await addDoc(collection(getClientDb(), SITES), {
    ownerUid: input.ownerUid,
    status: "draft",
    paid: false,
    paidAt: null,
    slug: null,
    published: null,
    publishedAt: null,
    draft: input.draft ?? null,
    sourceDescription: input.sourceDescription,
    generation: input.generation ?? { status: "understanding" },
    language: input.language,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
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

/** Drafts only — rules refuse to delete a paid or published site. */
export async function deleteDraftSite(siteId: string): Promise<void> {
  await deleteDoc(doc(getClientDb(), SITES, siteId));
}

/**
 * Used when an anonymous visitor signs in to an account that already exists:
 * the draft they built is copied into the account (the anonymous original is
 * unreachable afterwards and is cleaned up by Firebase's anonymous-user TTL).
 */
export async function copySiteToOwner(source: Site, ownerUid: string): Promise<string> {
  return createSite({
    ownerUid,
    sourceDescription: source.sourceDescription,
    language: source.language,
    generation: source.generation,
    draft: source.draft,
  });
}
