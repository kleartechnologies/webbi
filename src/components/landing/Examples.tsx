"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DEMO_SITES } from "@/lib/site/demo";
import { publicSitePath } from "@/lib/site/flow";
import { PRESETS } from "@/lib/site/presets";
import { BrowserChrome } from "./BrowserChrome";
import { HOST } from "./content";
import { ExampleRail } from "./ExampleRail";
import { Band, Eyebrow, Heading } from "./Section";
import { SitePreview } from "./SitePreview";

/** Three of the shipped example Webbis; each is a real site the renderer serves at /w/[slug]. */
const TABS: { slug: string; label: string; icon: IconName; caption: string }[] = [
  { slug: "rasa-kampung", label: "Restaurant & F&B", icon: "restaurant_menu", caption: "Rasa Kampung: menu, hours, location and an order button." },
  { slug: "hafiz-rahman", label: "Car sales advisor", icon: "directions_car", caption: "Hafiz Rahman: advisor profile, models, FAQ and a test-drive button." },
  { slug: "sereni", label: "Beauty & wellness", icon: "spa", caption: "Sereni: services, price list, reviews and a booking button." },
];

export function Examples() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];
  const site = DEMO_SITES[tab.slug];
  const preset = PRESETS[site.theme.preset];

  return (
    <Band id="examples" z={3} gutter={false} className="bg-ink text-white">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-4">
        <div className="lp-reveal flex flex-col gap-3">
          <Eyebrow className="text-sun">Examples</Eyebrow>
          <Heading className="max-w-[20ch]">Built for what you do.</Heading>
          <p className="max-w-[56ch] text-[clamp(16px,1.6vw,19px)] leading-[1.5] text-white/75">
            Every Webbi is laid out around one business. The words, the sections, the colours and the button all follow from what you sell.
          </p>
        </div>

        <div className="lp-reveal flex flex-col gap-4" style={{ "--lp-delay": "80ms" } as React.CSSProperties}>
          <div role="tablist" aria-label="Example websites" className="lp-rail -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
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
                  {t.label}
                </button>
              );
            })}
          </div>

          <div id="example-frame" role="tabpanel" className="overflow-hidden rounded-[26px] bg-surface shadow-[0_30px_70px_rgba(0,0,0,.4)]">
            <BrowserChrome
              url={`${HOST}${publicSitePath(tab.slug)}`}
              secure
              right={<span className="hidden text-[11px] font-bold uppercase tracking-[0.06em] text-muted sm:inline">{preset.label} style</span>}
            />
            <SitePreview key={tab.slug} site={site} width={1280} height="clamp(470px,58vh,640px)" className="bg-ground" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-white/55">
            <span>{tab.caption}</span>
            <Link href={publicSitePath(tab.slug)} prefetch={false} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-ui text-[13px] font-semibold text-white/80 transition-colors hover:text-white">
              Open this example
              <Icon name="open_in_new" size={15} />
            </Link>
          </div>
        </div>
      </div>

      <ExampleRail />
    </Band>
  );
}
