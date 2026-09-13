import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import {
  checkoutReturnPath,
  hasUnpublishedChanges,
  PAYMENT_CALLBACK_PATH,
  publicSiteUrl,
  resumePath,
  siteHost,
  siteName,
} from "../flow";
import type { Site } from "../types";
import type { SiteContent } from "../schema";

const content: SiteContent = {
  version: 1,
  language: "en",
  business: { name: "Hafiz Proton", tagline: "Test drives in Shah Alam", category: "car", whatsapp: "60123456789" },
  theme: { preset: "warm", primary: "#C8102E" },
  cta: { kind: "whatsapp", label: "Chat on WhatsApp" },
  sections: [{ type: "hero", headline: "Hafiz Proton", subheadline: "" }],
} as unknown as SiteContent;

function site(overrides: Partial<Site>): Site {
  const now = Timestamp.now();
  return {
    id: "site1",
    ownerUid: "u1",
    status: "draft",
    paid: false,
    paidAt: null,
    slug: null,
    published: null,
    publishedAt: null,
    draft: null,
    sourceDescription: "",
    generation: { status: "understanding" },
    language: "en",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Site;
}

describe("resumePath", () => {
  it("sends each generation state to the right screen", () => {
    expect(resumePath(site({ generation: { status: "understanding" } }))).toBe("/s/site1/confirm");
    expect(resumePath(site({ generation: { status: "generating" } }))).toBe("/s/site1/generating");
    expect(resumePath(site({ generation: { status: "ready" }, draft: content }))).toBe("/s/site1/ready");
    expect(resumePath(site({ generation: { status: "ready" }, draft: null }))).toBe("/s/site1/confirm");
    expect(resumePath(site({ status: "published", draft: content, published: content }))).toBe("/s/site1/edit");
  });
});

describe("hasUnpublishedChanges", () => {
  it("is false for drafts and for live sites whose draft equals what is published", () => {
    expect(hasUnpublishedChanges(site({ draft: content }))).toBe(false);
    expect(hasUnpublishedChanges(site({ status: "published", draft: content, published: content }))).toBe(false);
  });

  it("ignores key order and undefined fields", () => {
    const reordered = { ...content, business: { whatsapp: "60123456789", name: "Hafiz Proton", tagline: "Test drives in Shah Alam", category: "car", extra: undefined } };
    expect(hasUnpublishedChanges(site({ status: "published", draft: reordered as unknown as SiteContent, published: content }))).toBe(false);
  });

  it("is true once the owner edits a live site", () => {
    const edited = { ...content, business: { ...content.business, tagline: "New tagline" } };
    expect(hasUnpublishedChanges(site({ status: "published", draft: edited, published: content }))).toBe(true);
  });
});

describe("urls", () => {
  it("builds public URLs from NEXT_PUBLIC_SITE_URL", () => {
    expect(siteHost()).toBe("webbi.online");
    expect(publicSiteUrl("hafiz-proton")).toBe("https://webbi.online/w/hafiz-proton");
    // No query string: each payment adapter appends its own (Stripe's session_id, Billplz's signed billplz[…]).
    expect(checkoutReturnPath("site1")).toBe("/s/site1/publish/return");
    expect(PAYMENT_CALLBACK_PATH).toBe("/api/payments/webhook");
  });

  it("names a site from the draft, then the understanding, then a fallback", () => {
    expect(siteName(site({ draft: content }))).toBe("Hafiz Proton");
    expect(siteName(site({ generation: { status: "understood", understanding: { name: "Kedai Ali" } as never } }))).toBe("Kedai Ali");
    expect(siteName(site({}))).toBe("Untitled Webbi");
  });
});
