import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { Icon } from "@/components/ui/Icon";
import { getDemoSite } from "@/lib/site/demo";
import { heroImageOf } from "@/lib/site/hero";
import { siteStrings } from "@/lib/site/i18n";
import { getPublicSite } from "@/lib/site/publicStore";
import type { SiteContent } from "@/lib/site/schema";
import { isValidSlug } from "@/lib/site/slug";

type Params = Promise<{ slug: string }>;

type Loaded = { content: SiteContent; demo: boolean } | "unavailable" | null;

async function loadSite(slug: string): Promise<Loaded> {
  if (!isValidSlug(slug)) return null;
  const demo = getDemoSite(slug);
  if (demo) return { content: demo, demo: true };
  const live = await getPublicSite(slug);
  if (!live) return null;
  if ("suspended" in live) return "unavailable";
  return { content: live.content, demo: false };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadSite(slug);
  if (!site) return { title: "Not found", robots: { index: false } };
  if (site === "unavailable") return { title: { absolute: "Website unavailable" }, robots: { index: false, follow: false } };
  const { business, sections } = site.content;
  const hero = sections.find((s) => s.type === "hero");
  const title = business.tagline ? `${business.name} – ${business.tagline}` : business.name;
  const description =
    (hero?.type === "hero" && hero.subheadline) || [business.tagline, business.area].filter(Boolean).join(" · ") || business.name;
  const image = heroImageOf(site.content, hero?.type === "hero" ? hero : undefined)?.url;
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, type: "website", ...(image ? { images: [{ url: image }] } : {}) },
    robots: site.demo ? { index: false } : undefined,
  };
}

function DemoBanner({ site }: { site: SiteContent }) {
  const s = siteStrings(site.language);
  return (
    <div className="flex items-center justify-between gap-3 bg-navy px-4 py-2 text-[13px] text-white">
      <span className="truncate">{s.exampleBanner}</span>
      {/* A full page load into the app, which has its own security policy (src/lib/security/headers.ts). */}
      <a href="/start" className="flex shrink-0 items-center gap-1 rounded-pill bg-amber px-3 py-[6px] text-[12px] font-bold text-ink">
        {s.buildYours}
        <Icon name="arrow_forward" size={16} />
      </a>
    </div>
  );
}

/** A website Webbi has taken down. Deliberately says nothing about why, or whose it is. */
function SiteUnavailable() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 py-16 text-center" data-site-unavailable>
      <h1 className="text-h1">This website is currently unavailable.</h1>
      {/* A full page load into the app, which has its own security policy (src/lib/security/headers.ts). */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="text-body font-bold text-muted underline">
        Webbi
      </a>
    </main>
  );
}

export default async function PublicSitePage({ params }: { params: Params }) {
  const { slug } = await params;
  const site = await loadSite(slug);
  if (!site) notFound();
  if (site === "unavailable") return <SiteUnavailable />;
  return <SiteRenderer site={site.content} mode="public" banner={site.demo ? <DemoBanner site={site.content} /> : undefined} />;
}
