import Link from "next/link";
import { Icon } from "@/components/ui";
import { CATEGORIES } from "@/lib/site/categories";
import { publicSitePath } from "@/lib/site/flow";
import { PRESETS } from "@/lib/site/presets";
import { BUSINESSES, isLive, type ShowcaseBusiness } from "./businesses";
import { DESKTOP, DesktopSite, PHONE, PhoneSite } from "./MiniSite";
import { ShowcaseScroller } from "./ShowcaseScroller";

/** Scales a fixed-size drawing to its frame's width (the same CSS trick SitePreview uses). */
const fit = (width: number): React.CSSProperties => ({ transform: `scale(tan(atan2(100cqw, ${width}px)))` });

/**
 * A desktop and a phone view of one business's site. From lg the laptop view
 * leads with the phone beside it; below that the phone leads, since that is
 * what the visitor is holding.
 */
function Frames({ b }: { b: ShowcaseBusiness }) {
  return (
    <div aria-hidden data-site-preview className="relative aspect-[100/74] lg:aspect-[100/56]">
      <div className="@container absolute top-0 left-0 aspect-[720/450] w-[86%] overflow-hidden rounded-[10px] shadow-[0_22px_44px_rgba(0,0,0,.4)] transition-transform duration-500 group-hover:-translate-y-1 lg:top-[3%] lg:w-[78%] lg:rounded-[8px]">
        <div className="absolute top-0 left-0 origin-top-left" style={fit(DESKTOP.width)}>
          <DesktopSite b={b} />
        </div>
      </div>
      <div className="@container absolute right-0 bottom-0 aspect-[220/452] w-[35%] drop-shadow-[0_18px_28px_rgba(0,0,0,.5)] transition-transform duration-500 group-hover:-translate-y-2 lg:w-[24%]">
        <div className="absolute top-0 left-0 origin-top-left" style={fit(PHONE.width)}>
          <PhoneSite b={b} />
        </div>
      </div>
    </div>
  );
}

function Card({ b }: { b: ShowcaseBusiness }) {
  const category = CATEGORIES[b.category];
  const id = `showcase-${b.slug}`;
  return (
    <li className="w-[min(84vw,420px)] shrink-0 snap-center sm:w-[min(62vw,460px)] lg:w-auto">
      <article aria-labelledby={id} className="group flex h-full flex-col gap-3">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-[2px]">
            <h4 id={id} className="font-display text-[19px] font-extrabold leading-[1.15] tracking-[-0.02em]">{b.name}</h4>
            <p className="text-[13px] text-white/60">{b.sub}</p>
          </div>
          <span className="mt-[2px] shrink-0 rounded-pill border border-white/18 px-[10px] py-[3px] text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/75">
            {PRESETS[b.template].label}
          </span>
        </header>
        <Frames b={b} />
        <footer className="mt-1 flex min-h-6 items-center justify-between gap-3 text-[12.5px]">
          <span className="inline-flex items-center gap-[6px] text-white/60">
            <Icon name={category.ctaIcon} size={15} className="text-sun" />
            {category.cta}
          </span>
          {isLive(b) ? (
            <Link
              href={publicSitePath(b.slug)}
              prefetch={false}
              target="_blank"
              rel="noopener"
              aria-label={`Open the ${b.name} example website`}
              className="inline-flex items-center gap-1 font-semibold text-white/80 transition-colors hover:text-white"
            >
              Open example
              <Icon name="open_in_new" size={15} />
            </Link>
          ) : null}
        </footer>
      </article>
    </li>
  );
}

/** Nine kinds of business, each drawn in its Webbi template: proof it is not only for restaurants. */
export function BusinessShowcase() {
  return (
    <div className="mt-[clamp(56px,7vw,104px)] flex flex-col gap-[clamp(22px,3vw,40px)]">
      <div className="lp-reveal mx-auto flex w-full max-w-[1180px] flex-wrap items-end justify-between gap-x-10 gap-y-3 px-4">
        <div className="flex max-w-[640px] flex-col gap-2">
          <h3 className="font-display text-[clamp(24px,3vw,36px)] font-extrabold leading-[1.08] tracking-[-0.03em] text-balance">Nine kinds of business. One way to start.</h3>
          <p className="text-[clamp(15px,1.4vw,17px)] leading-[1.5] text-white/68">
            A nasi lemak stall, a Proton advisor, a tutor, an accountant. Each Webbi gets the template, the words and the button that suit the business.
          </p>
        </div>
        <p className="font-mono text-[11px] tracking-[0.04em] text-white/50">Warm · Bold · Bright · Elegant · Trust</p>
      </div>
      <div className="lp-reveal flex flex-col gap-4" style={{ "--lp-delay": "80ms" } as React.CSSProperties}>
        <ShowcaseScroller count={BUSINESSES.length}>
          {BUSINESSES.map((b) => <Card key={b.slug} b={b} />)}
        </ShowcaseScroller>
      </div>
    </div>
  );
}
