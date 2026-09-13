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

/**
 * Firestore document at userQuotas/{uid}. Server only: clients can neither read
 * nor write it. Enforces one unpublished website per account (see drafts.ts).
 */
export interface UserQuotaDoc {
  /** The account's unpublished website, or null once it is published or deleted. */
  openDraftSiteId: string | null;
  /** Websites started on draftsDay. Deleting a draft never lowers it. */
  draftsCreatedToday: number;
  /** Server calendar day (Asia/Kuala_Lumpur, YYYY-MM-DD) that draftsCreatedToday counts. */
  draftsDay: string;
  updatedAt: Timestamp;
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
 * readable, written only by the server after verified payment. Holds nothing
 * about the owner beyond the content they chose to publish.
 */
export interface PublicSiteDoc {
  siteId: string;
  slug: string;
  content: SiteContent;
  publishedAt: Timestamp;
  updatedAt: Timestamp;
}

/** Firestore document at slugs/{slug}: who owns a link. Server only. */
export interface SlugDoc {
  siteId: string;
  ownerUid: string;
  createdAt: Timestamp;
}

export type PaymentStatus = "pending" | "paid" | "failed";

/**
 * Firestore document at payments/{paymentId}. Created by the server when a
 * checkout starts; marked paid only after the provider confirms it.
 */
export interface PaymentDoc {
  siteId: string;
  ownerUid: string;
  /** Link requested at checkout. The final slug is on the site document. */
  slug: string;
  amountSen: number;
  currency: "myr";
  provider: "billplz" | "stripe" | "mock";
  /** Provider's checkout id (Billplz bill id, Stripe session id). */
  providerRef: string | null;
  status: PaymentStatus;
  failureReason: string | null;
  /**
   * Set when this payment was confirmed for a site another payment had already
   * published. The money was taken, so it is recorded as paid and needs a refund.
   */
  duplicate?: boolean;
  createdAt: Timestamp;
  paidAt: Timestamp | null;
  updatedAt: Timestamp;
}
