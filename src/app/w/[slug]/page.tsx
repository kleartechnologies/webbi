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

async function loadSite(slug: string): Promise<{ content: SiteContent; demo: boolean } | null> {
  if (!isValidSlug(slug)) return null;
  const demo = getDemoSite(slug);
  if (demo) return { content: demo, demo: true };
  const live = await getPublicSite(slug);
  return live ? { content: live.content, demo: false } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadSite(slug);
  if (!site) return { title: "Not found", robots: { index: false } };
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

export default async function PublicSitePage({ params }: { params: Params }) {
  const { slug } = await params;
  const site = await loadSite(slug);
  if (!site) notFound();
  return <SiteRenderer site={site.content} mode="public" banner={site.demo ? <DemoBanner site={site.content} /> : undefined} />;
}
