import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_SITES } from "@/lib/site/demo";
import PublicSitePage, { generateMetadata } from "../[slug]/page";

/**
 * Phase F: the public page for a link, read the way production reads it
 * (Firestore REST, faked at fetch). A suspended link shows one generic
 * sentence and nothing from the document behind it.
 */

type Fields = Record<string, unknown>;

/** A value as the Firestore REST API returns it. */
function encode(value: unknown): unknown {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: encodeFields(value as Fields) } };
}

const encodeFields = (fields: Fields) =>
  Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encode(v)]));

const SECRETS = {
  moderationReason: "Phishing reported by Bank X, case 4471",
  siteId: "site-secret-id",
  ownerUid: "owner-secret-uid",
  paymentId: "payment-secret-id",
};

let docs: Map<string, Fields>;
let fetchMock: ReturnType<typeof vi.fn>;

function content() {
  const site = structuredClone(DEMO_SITES["hafiz-rahman"]);
  site.business.name = "Kedai Aisyah Test";
  return site;
}

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const render = async (slug: string) => renderToStaticMarkup(await PublicSitePage(params(slug)));

beforeEach(() => {
  docs = new Map();
  fetchMock = vi.fn(async (input: string) => {
    const slug = decodeURIComponent(/\/documents\/publicSites\/([^?]+)\?key=/.exec(String(input))?.[1] ?? "");
    const fields = docs.get(slug);
    if (!fields) return new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 });
    return new Response(JSON.stringify({ name: `publicSites/${slug}`, fields: encodeFields(fields) }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/w/[slug] and moderation", () => {
  it("renders an active published website, fetched by its own link only", async () => {
    docs.set("kedai-aisyah", { siteId: "site-a", slug: "kedai-aisyah", content: content(), publishedAt: "2026-09-13T00:00:00Z" });
    const markup = await render("kedai-aisyah");
    expect(markup).toContain("Kedai Aisyah Test");
    expect(markup).not.toContain("currently unavailable");
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/documents\/publicSites\/kedai-aisyah\?key=/);
    expect((await generateMetadata(params("kedai-aisyah"))).title).toEqual({ absolute: expect.stringContaining("Kedai Aisyah Test") });

    // A marker explicitly set to false doesn't take a site down.
    docs.set("kedai-aisyah", { ...docs.get("kedai-aisyah"), suspended: false });
    expect(await render("kedai-aisyah")).toContain("Kedai Aisyah Test");
  });

  it("shows only a generic notice for a suspended link, with nothing from the document", async () => {
    docs.set("kedai-aisyah", { slug: "kedai-aisyah", suspended: true, updatedAt: "2026-09-13T00:00:00Z" });
    const markup = await render("kedai-aisyah");
    expect(markup).toContain("This website is currently unavailable.");
    expect(markup).toContain("data-site-unavailable");
    expect(markup).not.toMatch(/<script|<iframe|<img/i);

    const metadata = await generateMetadata(params("kedai-aisyah"));
    expect(metadata).toEqual({ title: { absolute: "Website unavailable" }, robots: { index: false, follow: false } });
  });

  it("never renders content, reason, owner or ids from a document marked suspended, whatever else it holds", async () => {
    for (const suspended of [true, "yes", 1]) {
      docs.set("kedai-aisyah", { slug: "kedai-aisyah", content: content(), suspended, ...SECRETS });
      const markup = await render("kedai-aisyah");
      const metadata = JSON.stringify(await generateMetadata(params("kedai-aisyah")));
      expect(markup).toContain("This website is currently unavailable.");
      for (const leak of ["Kedai Aisyah Test", ...Object.values(SECRETS)]) {
        expect(markup).not.toContain(leak);
        expect(metadata).not.toContain(leak);
      }
    }
  });

  it("still 404s a link with nothing published", async () => {
    await expect(render("nothing-here")).rejects.toThrow();
    expect((await generateMetadata(params("nothing-here"))).title).toBe("Not found");
  });
});
