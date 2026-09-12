import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { presetStyle } from "@/lib/site/presets";
import type { Section as SiteSection, SiteContent } from "@/lib/site/schema";
import { buildCtx, buildNav, type RenderCtx, type RenderMode } from "./context";
import { Hero, heroIncludesCta } from "./Hero";
import { PrimaryCta, QuickNav } from "./HeroActions";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { StickyCta } from "./StickyCta";
import { About } from "./sections/About";
import { Contact } from "./sections/Contact";
import { CtaPanel } from "./sections/CtaPanel";
import { Faq } from "./sections/Faq";
import { Gallery } from "./sections/Gallery";
import { Highlights } from "./sections/Highlights";
import { Location } from "./sections/Location";
import { Offerings } from "./sections/Offerings";
import { Reviews } from "./sections/Reviews";

export interface SiteRendererProps {
  site: SiteContent;
  mode?: RenderMode;
  /** Sticky bottom CTA bar (off for scaled desktop previews). */
  stickyCta?: boolean;
  /** Optional strip above the site header (e.g. "This is an example Webbi"). */
  banner?: ReactNode;
  className?: string;
}

function renderSection(ctx: RenderCtx, section: SiteSection): ReactNode {
  switch (section.type) {
    case "hero":
      return null;
    case "offerings":
      return <Offerings key={section.id} ctx={ctx} section={section} />;
    case "highlights":
      return <Highlights key={section.id} ctx={ctx} section={section} />;
    case "about":
      return <About key={section.id} ctx={ctx} section={section} />;
    case "gallery":
      return <Gallery key={section.id} ctx={ctx} section={section} />;
    case "reviews":
      return <Reviews key={section.id} ctx={ctx} section={section} />;
    case "faq":
      return <Faq key={section.id} ctx={ctx} section={section} />;
    case "location":
      return <Location key={section.id} ctx={ctx} section={section} />;
    case "contact":
      return <Contact key={section.id} ctx={ctx} section={section} />;
    case "cta":
      return <CtaPanel key={section.id} ctx={ctx} section={section} />;
  }
}

/**
 * The one renderer every Webbi goes through: the live site at /w/[slug], the
 * ready-screen preview, the editor preview and the landing phone all render
 * the same structured Site JSON with this component. No hooks, so it works in
 * server and client components alike. Layout switches on the container width
 * (@md / @3xl), so a scaled 1100px preview gets the desktop layout.
 */
export function SiteRenderer({ site, mode = "public", stickyCta = true, banner, className }: SiteRendererProps) {
  const ctx = buildCtx(site, mode);
  const nav = buildNav(ctx);
  const sections = site.sections.filter((s) => s.enabled);
  const hero = sections.find((s) => s.type === "hero");
  const ctaInHero = hero?.type === "hero" ? heroIncludesCta(ctx, hero) : ctx.preset.heroDark;

  return (
    <div
      lang={site.language === "ms" ? "ms" : "en"}
      data-preset={ctx.preset.id}
      className={cn(
        "@container relative flex w-full flex-col bg-site-ground font-ui text-site-ink antialiased",
        mode === "public" ? "min-h-dvh" : "min-h-full",
        className,
      )}
      style={presetStyle(ctx.preset, site.theme.accent)}
    >
      {banner}
      <SiteHeader ctx={ctx} nav={nav} />
      <main className="flex flex-col">
        {hero && hero.type === "hero" ? <Hero ctx={ctx} section={hero} /> : null}
        {!ctaInHero ? <PrimaryCta ctx={ctx} /> : null}
        <QuickNav items={nav} />
        {sections.map((section) => renderSection(ctx, section))}
      </main>
      <SiteFooter ctx={ctx} />
      {stickyCta ? <StickyCta ctx={ctx} /> : null}
    </div>
  );
}
