import type { Timestamp } from "firebase/firestore";
import type { GenerationInput, Language, SiteContent, Understanding } from "./schema";

export type SiteStatus = "draft" | "published";

export type GenerationStatus =
  | "understanding"
  | "understood"
  | "generating"
  | "ready"
  | "error";

export interface GenerationState {
  status: GenerationStatus;
  understanding?: Understanding;
  /** Owner-confirmed details (Confirm + Content screens). */
  input?: GenerationInput;
  /** User-facing message when status === "error". */
  error?: string;
  model?: string;
}

/** Firestore document at sites/{siteId}. Readable only by its owner. */
export interface SiteDoc {
  ownerUid: string;
  status: SiteStatus;
  paid: boolean;
  paidAt: Timestamp | null;
  slug: string | null;
  /** Snapshot copied to publicSites/{slug} by the server on publish. */
  published: SiteContent | null;
  publishedAt: Timestamp | null;
  draft: SiteContent | null;
  sourceDescription: string;
  generation: GenerationState;
  language: Language;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Site extends SiteDoc {
  id: string;
}

/** Firestore document at users/{uid}. */
export interface UserDoc {
  displayName: string | null;
  email: string | null;
  locale: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Firestore document at publicSites/{slug}: the live copy of a site. World
 * readable, written only by the server after verified payment.
 */
export interface PublicSiteDoc {
  siteId: string;
  ownerUid: string;
  slug: string;
  content: SiteContent;
  publishedAt: Timestamp;
  updatedAt: Timestamp;
}
