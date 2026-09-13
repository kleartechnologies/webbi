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
  /** The payment that published this site. Missing on sites published before it was recorded. */
  paymentId?: string | null;
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
  /** Malaysia day (YYYY-MM-DD) that aiRequestsToday counts. Missing on accounts that never used the AI. */
  aiDay?: string;
  /** AI requests (understand + generate) accepted on aiDay, including failed ones. See src/lib/ai/guard.ts. */
  aiRequestsToday?: number;
  /** Malaysia month (YYYY-MM) that aiRequestsThisMonth counts. */
  aiMonth?: string;
  aiRequestsThisMonth?: number;
  /** Malaysia day (YYYY-MM-DD) that uploadsToday counts. */
  uploadsDay?: string;
  /** Photos stored on uploadsDay. Refused uploads don't count; deleting a photo never lowers it. See src/lib/images/storage.ts. */
  uploadsToday?: number;
  updatedAt: Timestamp;
}

/**
 * Firestore document at siteAi/{siteId}. Server only. Counts the AI requests
 * made for one website and holds its lock. Deleted with the draft.
 */
export interface SiteAiDoc {
  ownerUid: string;
  /** Accepted "read my description" requests. */
  understandings: number;
  /** Accepted website builds: the first and every rebuild. */
  generations: number;
  /** Set while a request runs; stale after AI_LOCK_TTL_MS. */
  lock: { requestId: string; kind: "understand" | "generate"; startedAt: number } | null;
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
 * Why a paid payment hasn't (yet) published its website. Only ever set together
 * with status "paid": the money is real, so the payment is never marked failed.
 *  - fulfilment_pending: recorded paid, publishing hasn't finished (normally for milliseconds)
 *  - invalid_draft / slug_unavailable / fulfilment_error: publishing failed; retryable
 *  - site_missing / owner_mismatch / amount_mismatch / duplicate: never publishes; refund by hand
 */
export type PaymentAttentionReason =
  | "fulfilment_pending"
  | "invalid_draft"
  | "slug_unavailable"
  | "fulfilment_error"
  | "site_missing"
  | "owner_mismatch"
  | "amount_mismatch"
  | "duplicate";

/**
 * Firestore document at payments/{paymentId}. Created by the server when a
 * checkout starts; marked paid only after the provider confirms it.
 *
 * pending → paid (provider confirmed) → published (fulfilledAt set)
 * pending → failed (provider says the bill is gone, or its draft was deleted)
 * paid + needsAttention: money taken, website not live. See PaymentAttentionReason.
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
  /** The provider's hosted page for this checkout, so an open bill can be reused. */
  checkoutUrl?: string | null;
  status: PaymentStatus;
  failureReason: string | null;
  /** What the provider says was collected, recorded when it confirms payment. */
  paidAmountSen?: number;
  /** True while a paid payment's website isn't live. Cleared when it publishes. */
  needsAttention?: boolean;
  attentionReason?: PaymentAttentionReason | null;
  /**
   * Set when this payment was confirmed for a site another payment had already
   * published. The money was taken, so it is recorded as paid and needs a refund.
   */
  duplicate?: boolean;
  createdAt: Timestamp;
  paidAt: Timestamp | null;
  /** When this payment published its website. */
  fulfilledAt?: Timestamp | null;
  updatedAt: Timestamp;
}
