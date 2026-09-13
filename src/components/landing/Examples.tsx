"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DEMO_SITES } from "@/lib/site/demo";
import { publicSitePath } from "@/lib/site/flow";
import { PRESETS } from "@/lib/site/presets";
import { resolveTemplateId } from "@/lib/site/templates";
import { BrowserChrome } from "./BrowserChrome";
import { HOST } from "./content";
import { useLandingCopy } from "./i18n/LandingLanguage";
import { Band, Eyebrow, Heading } from "./Section";
import { BusinessShowcase } from "./showcase/BusinessShowcase";
import { SitePreview } from "./SitePreview";

/** Three of the shipped example Webbis; each is a real site the renderer serves at /w/[slug]. Labels and captions are in copy.examples.tabs, in this order. */
const TABS: { slug: string; icon: IconName }[] = [
  { slug: "rasa-kampung", icon: "restaurant_menu" },
  { slug: "hafiz-rahman", icon: "directions_car" },
  { slug: "sereni", icon: "spa" },
];

export function Examples() {
  const { examples } = useLandingCopy();
  const [active, setActive] = useState(0);
  const tab = TABS[active];
  const words = examples.tabs[active];
  const site = DEMO_SITES[tab.slug];
  const preset = PRESETS[resolveTemplateId(site)];

  return (
    <Band id="examples" z={3} gutter={false} className="bg-ink text-white">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-4">
        <div className="lp-reveal flex flex-col gap-3">
          <Eyebrow className="text-sun">{examples.eyebrow}</Eyebrow>
          <Heading className="max-w-[20ch]">{examples.title}</Heading>
          <p className="max-w-[56ch] text-[clamp(16px,1.6vw,19px)] leading-[1.5] text-white/75">
            {examples.lede}
          </p>
        </div>

        <div className="lp-reveal flex flex-col gap-4" style={{ "--lp-delay": "80ms" } as React.CSSProperties}>
          <div role="tablist" aria-label={examples.tablist} className="lp-rail -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
            {TABS.map((t, i) => {
              const selected = i === active;
              return (
                <button
                  key={t.slug}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="example-frame"
                  onClick={() => setActive(i)}
                  className={cn(
                    "flex h-[46px] shrink-0 items-center gap-2 rounded-pill border-[1.5px] px-[18px] text-[15px] font-bold whitespace-nowrap transition-[transform,background-color,border-color] duration-200 hover:-translate-y-[2px]",
                    selected ? "border-sun bg-sun text-ink" : "border-white/22 bg-transparent text-white hover:border-white/40",
                  )}
                >
                  <Icon name={t.icon} size={19} />
                  {examples.tabs[i].label}
                </button>
              );
            })}
          </div>

          <div id="example-frame" role="tabpanel" className="overflow-hidden rounded-[26px] bg-surface shadow-[0_30px_70px_rgba(0,0,0,.4)]">
            <BrowserChrome
              url={`${HOST}${publicSitePath(tab.slug)}`}
              secure
              right={<span className="hidden text-[11px] font-bold uppercase tracking-[0.06em] whitespace-nowrap text-muted sm:inline">{examples.style(preset.label)}</span>}
            />
            <SitePreview key={tab.slug} site={site} width={1280} height="clamp(470px,58vh,640px)" className="bg-ground" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-white/55">
            <span>{words.caption}</span>
            <Link href={publicSitePath(tab.slug)} prefetch={false} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-ui text-[13px] font-semibold text-white/80 transition-colors hover:text-white">
              {examples.open}
              <Icon name="open_in_new" size={15} />
            </Link>
          </div>
        </div>
      </div>

      <BusinessShowcase />
    </Band>
  );
}
