import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEMO_SITES } from "@/lib/site/demo";
import { siteContentSchema, type SiteContent } from "@/lib/site/schema";
import { SiteRenderer } from "../SiteRenderer";

/**
 * A customer website is structured data rendered as escaped text. Whatever an
 * owner (or a crafted draft) puts in the fields, the public page can't run a
 * script, gain an event handler or link to a dangerous scheme.
 */

const HOSTILE_TEXT = `<script>alert(1)</script><img src=x onerror=alert(1)>"><svg onload=alert(1)>`;
const UNSAFE_SCHEMES = ["javascript:alert(1)", "JavaScript:alert(document.cookie)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)", "file:///etc/passwd"];
/** What a clickable or loaded URL on a public site may start with (a phone with no digits left becomes an inert `tel:+`). */
const ALLOWED = /^(https:\/\/|http:\/\/|tel:\+\d*$|mailto:|\/(?!\/)|#)/;

const html = (site: SiteContent) => renderToStaticMarkup(<SiteRenderer site={site} mode="public" />);
const urls = (markup: string) =>
  [...markup.matchAll(/\s(href|src|action|formaction|srcset)="([^"]*)"/gi)].map((m) => m[2].replace(/&amp;/g, "&"));

function hostileSite(unsafe: string): SiteContent {
  const site = structuredClone(DEMO_SITES["hafiz-rahman"]);
  site.business.name = HOSTILE_TEXT;
  site.business.tagline = HOSTILE_TEXT;
  site.business.phone = unsafe;
  site.business.instagram = unsafe;
  site.business.facebook = unsafe;
  site.business.tiktok = unsafe;
  site.business.address = HOSTILE_TEXT;
  site.cta = { ...site.cta, kind: "link", label: HOSTILE_TEXT.slice(0, 40), href: unsafe };
  return site;
}

/** Owner-written text fields, wherever they sit in a site. Ids, kinds, colours and URLs are left alone. */
const TEXT_KEYS = new Set([
  "name", "tagline", "title", "subtitle", "headline", "subheadline", "eyebrow", "body", "description", "price",
  "question", "answer", "quote", "author", "label", "text", "note", "address", "area", "message", "caption", "role", "summary",
]);

function withHostileText<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withHostileText) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, typeof v === "string" && TEXT_KEYS.has(key) ? HOSTILE_TEXT : withHostileText(v)]),
    ) as T;
  }
  return value;
}

describe("public renderer: customer content can't become markup or script", () => {
  it.each(UNSAFE_SCHEMES)("renders %s in every link field as nothing clickable", (unsafe) => {
    const markup = html(hostileSite(unsafe));
    expect(markup).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/<svg[^>]*onload/i);
    // React escapes quotes and angle brackets inside attribute values, so with
    // every value blanked what remains is the real tag and attribute structure.
    expect(markup.replace(/="[^"]*"/g, '=""')).not.toMatch(/<[a-z]+[^>]*\son[a-z]+=/i);
    for (const url of urls(markup)) expect(url, url).toMatch(ALLOWED);
    // The hostile text is still shown, as text.
    expect(markup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("keeps the legitimate WhatsApp, phone, email, Maps and social links working", () => {
    const site = structuredClone(DEMO_SITES["hafiz-rahman"]);
    site.business.phone = "+60 12-345 6789";
    site.business.email = "hafiz@example.com";
    site.business.instagram = "@hafiz.cars";
    site.business.address = "No. 1, Jalan Balakong, Selangor";
    site.sections.push({ id: "contact-x", type: "contact", title: "Contact" } as SiteContent["sections"][number]);
    site.sections.push({ id: "loc-x", type: "location", address: site.business.address } as SiteContent["sections"][number]);
    const markup = html(site);
    expect(markup).toContain('href="https://wa.me/');
    expect(markup).toContain('href="tel:+60123456789"');
    expect(markup).toContain('href="mailto:hafiz@example.com"');
    expect(markup).toContain('href="https://www.google.com/maps/search/');
    expect(markup).toContain('src="https://www.google.com/maps?q=');
    expect(markup).toContain('href="https://www.instagram.com/hafiz.cars/"');
    for (const url of urls(markup)) expect(url, url).toMatch(ALLOWED);
  });

  it("refuses unsafe image URLs at the schema, so a published page never loads one", () => {
    for (const unsafe of [...UNSAFE_SCHEMES, "//evil.example/x.png"]) {
      const site = structuredClone(DEMO_SITES["hafiz-rahman"]);
      site.business.logo = { url: unsafe };
      expect(siteContentSchema.safeParse(site).success, unsafe).toBe(false);
    }
  });

  it.each(Object.keys(DEMO_SITES))("shows hostile text in every text field of %s as text, with no tag, handler or style injection", (slug) => {
    const markup = html(withHostileText(DEMO_SITES[slug]));
    expect(markup).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/<svg[^>]*onload/i);
    const structure = markup.replace(/="[^"]*"/g, '=""');
    expect(structure).not.toMatch(/<[a-z]+[^>]*\son[a-z]+=/i);
    expect(markup.split("&lt;script&gt;alert(1)&lt;/script&gt;").length - 1).toBeGreaterThanOrEqual(5);
    for (const url of urls(markup)) expect(url, url).toMatch(ALLOWED);
    for (const [, src] of markup.matchAll(/<iframe[^>]*\ssrc="([^"]*)"/gi)) expect(src).toMatch(/^https:\/\/www\.google\.com\/maps\?/);
    for (const [, style] of markup.matchAll(/\sstyle="([^"]*)"/gi)) expect(style).not.toMatch(/url\(|expression|javascript|&lt;/i);
  });

  it("keeps a hostile http(s) link inside its own attribute, never a new attribute or tag", () => {
    for (const href of [
      `https://evil.example/"><script>alert(1)</script>`,
      `https://evil.example/' onmouseover='alert(1)`,
      `https://evil.example/" autofocus onfocus="alert(1)`,
    ]) {
      const site = structuredClone(DEMO_SITES["hafiz-rahman"]);
      site.cta = { ...site.cta, kind: "link", href };
      site.business.instagram = href;
      site.business.facebook = href;
      const markup = html(site);
      expect(markup).not.toMatch(/<script/i);
      const structure = markup.replace(/="[^"]*"/g, '=""');
      expect(structure).not.toMatch(/<[a-z]+[^>]*\s(on[a-z]+|autofocus)=/i);
      for (const url of urls(markup)) expect(url, url).toMatch(ALLOWED);
    }
  });

  it("refuses data:, blob: and SVG image addresses at the schema", () => {
    for (const unsafe of [
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>",
      "data:image/png;base64,iVBORw0KGgo=",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "blob:https://webbi.online/0b6c",
      " javascript:alert(1)",
    ]) {
      const site = structuredClone(DEMO_SITES["hafiz-rahman"]);
      site.business.logo = { url: unsafe };
      expect(siteContentSchema.safeParse(site).success, unsafe).toBe(false);
    }
  });

  it("has no raw-HTML escape hatch in the renderer or the public page", () => {
    const root = process.cwd();
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === "__tests__" ? [] : walk(full);
        return /\.tsx?$/.test(entry.name) ? [full] : [];
      });
    const files = [...walk(path.join(root, "src/components/site")), ...walk(path.join(root, "src/app/w"))];
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/dangerouslySetInnerHTML|innerHTML|next\/script|<script|eval\(|new Function/);
    }
  });

  it("serves the public page without authentication or the Firebase SDK", () => {
    const page = readFileSync(path.join(process.cwd(), "src/app/w/[slug]/page.tsx"), "utf8");
    const store = readFileSync(path.join(process.cwd(), "src/lib/site/publicStore.ts"), "utf8");
    for (const source of [page, store]) {
      expect(source).not.toMatch(/auth\/verify|AuthProvider|firebase\/auth|firebase-admin|authorization/i);
    }
  });
});
