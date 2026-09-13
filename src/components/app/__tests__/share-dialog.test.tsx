import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Site } from "@/lib/site/types";

// The card's draft delete action talks to Firestore; the markup tests never need it.
vi.mock("@/lib/site/store", () => ({ deleteDraftSite: vi.fn() }));

const { ShareDialog } = await import("../ShareDialog");
const { SiteCard } = await import("../SiteCard");

const TARGET = {
  name: "Amir (Perodua Sales Advisor)",
  url: "https://webbi.online/w/amir-perodua-sales-advisor",
  slug: "amir-perodua-sales-advisor",
};

function site(overrides: Partial<Site> = {}): Site {
  return {
    id: "Xk29fPq0aZ7firebaseId",
    ownerUid: "owner-1",
    status: "published",
    paid: true,
    slug: "amir-perodua-sales-advisor",
    updatedAt: null,
    draft: { business: { name: TARGET.name }, sections: [], theme: {} },
    ...overrides,
  } as unknown as Site;
}

describe("ShareDialog markup", () => {
  const html = renderToStaticMarkup(<ShareDialog target={TARGET} onClose={() => {}} />);

  it("is a dialog named by its heading", () => {
    const labelledBy = /<dialog[^>]*aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(html).toMatch(new RegExp(`<h2 id="${labelledBy}"[^>]*>Share your website</h2>`));
  });

  it("has a labelled close button", () => {
    expect(html).toMatch(/<button type="button" aria-label="Close"/);
  });

  it("shows the public URL in a labelled, read-only field", () => {
    const id = /<label for="([^"]+)"[^>]*>Website link<\/label>/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toMatch(new RegExp(`<input[^>]*id="${id}"[^>]*readOnly=""[^>]*value="${TARGET.url}"`));
    expect(html).not.toMatch(/dashboard|\/edit|Xk29f/);
  });

  it("has text on every action, not just icons", () => {
    for (const label of ["Download PNG", "Download SVG", "Copy", "Share", "Scan to visit your website"]) {
      expect(html).toContain(label);
    }
  });

  it("announces feedback politely", () => {
    expect(html).toMatch(/<p role="status" aria-live="polite"/);
  });

  it("keeps downloads disabled until the QR code is ready", () => {
    expect(html.match(/<button type="button" disabled=""[^>]*>/g)).toHaveLength(2);
  });
});

describe("SiteCard share action", () => {
  it("offers Share on a published site, as a dialog trigger, alongside View and Edit", () => {
    const html = renderToStaticMarkup(<SiteCard site={site()} />);
    expect(html).toMatch(/<button type="button" aria-haspopup="dialog"[^>]*>.*Share<\/button>/);
    expect(html).toContain('href="/w/amir-perodua-sales-advisor"');
    expect(html).toContain('href="/s/Xk29fPq0aZ7firebaseId/edit"');
    // The dialog itself (and the QR library) isn't rendered until Share is pressed.
    expect(html).not.toContain("Share your website");
  });

  it("offers no Share on drafts", () => {
    for (const draft of [site({ status: "draft", slug: null }), site({ status: "draft" })]) {
      const html = renderToStaticMarkup(<SiteCard site={draft} />);
      expect(html).not.toContain("Share");
      expect(html).toContain("Continue");
    }
  });
});
