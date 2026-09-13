import Image from "next/image";
import { BRIGHT_TINTS } from "@/components/site/skin";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CATEGORIES } from "@/lib/site/categories";
import { PRESETS, presetStyle, type PresetId } from "@/lib/site/presets";
import { HOST, vars } from "../content";
import type { ShowcaseBusiness } from "./businesses";

/** Design sizes the mockups are drawn at, then scaled to fit their frames. */
export const DESKTOP = { width: 720, height: 450 };
export const PHONE = { width: 220, height: 452 };

/**
 * Each template's character at mockup scale, lifted from the renderer's skins
 * (src/components/site/skin.ts): type, button shape and button colours.
 */
const LOOK: Record<PresetId, { heading: string; h1: string; ph1: string; btn: string; primary: string; outline: string; icon: string }> = {
  warm: {
    heading: "font-site font-bold tracking-[-0.01em]",
    h1: "text-[40px] leading-[1.04]",
    ph1: "text-[23px] leading-[1.08]",
    btn: "rounded-full font-bold",
    primary: "bg-site-accent text-white",
    outline: "border-[1.5px] border-site-ink text-site-ink",
    icon: "rounded-full bg-site-accent/10 text-site-accent",
  },
  elegant: {
    heading: "font-site font-normal",
    h1: "text-[40px] leading-[1.08]",
    ph1: "text-[23px] leading-[1.1]",
    btn: "rounded-none font-semibold tracking-[0.04em]",
    primary: "bg-site-ink text-site-ground",
    outline: "border border-[#C7B6B1] text-site-ink",
    icon: "rounded-full border border-site-line text-site-accent",
  },
  bold: {
    heading: "font-site font-extrabold uppercase site-wide",
    h1: "text-[42px] leading-[0.92]",
    ph1: "text-[22px] leading-[0.95]",
    btn: "rounded-none font-extrabold uppercase tracking-[0.07em]",
    primary: "bg-site-accent text-white",
    outline: "border-2 border-white text-white",
    icon: "bg-site-accent/10 text-site-accent",
  },
  trust: {
    heading: "font-site font-bold tracking-[-0.02em]",
    h1: "text-[35px] leading-[1.08]",
    ph1: "text-[21px] leading-[1.12]",
    btn: "rounded-[6px] font-semibold",
    primary: "bg-site-accent text-white",
    outline: "border-[1.5px] border-site-ink bg-white text-site-ink",
    icon: "rounded-[8px] bg-site-accent/10 text-site-accent",
  },
  bright: {
    heading: "font-site font-bold tracking-[-0.025em]",
    h1: "text-[40px] leading-[1.04]",
    ph1: "text-[23px] leading-[1.08]",
    btn: "rounded-[10px] font-bold",
    primary: "bg-site-accent text-white",
    outline: "border-[1.5px] border-site-ink text-site-ink",
    icon: "rounded-[10px] text-site-ink",
  },
};

const tintOf = (b: ShowcaseBusiness, i = 0) => BRIGHT_TINTS[((b.tint ?? 0) + i) % BRIGHT_TINTS.length];

function Photo({ b, sizes, className }: { b: ShowcaseBusiness; sizes: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden", className)}>
      <Image src={b.photo.src} alt="" fill sizes={sizes} className="object-cover" style={{ objectPosition: b.photo.position ?? "50% 50%" }} />
    </div>
  );
}

function Mark({ b, small = false }: { b: ShowcaseBusiness; small?: boolean }) {
  const t = b.template;
  const icon = CATEGORIES[b.category].icon;
  if (t === "elegant") {
    return <span className={cn("font-site uppercase tracking-[0.18em] text-site-ink", small ? "text-[10px]" : "text-[14px]")}>{b.name}</span>;
  }
  const box = small ? "h-[18px] w-[18px]" : "h-[24px] w-[24px]";
  return (
    <span className={cn("flex items-center", small ? "gap-[6px]" : "gap-2")}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center",
          box,
          t === "warm" && "rounded-full bg-site-accent text-white",
          t === "bold" && "bg-site-accent font-site font-extrabold text-white",
          t === "trust" && "rounded-[6px] bg-site-accent text-white",
          t === "bright" && cn("rounded-[7px] text-site-ink", tintOf(b).panel),
        )}
      >
        {t === "bold" ? <span className={small ? "text-[10px]" : "text-[13px]"}>{b.name[0]}</span> : <Icon name={icon} size={small ? 11 : 15} fill />}
      </span>
      <span
        className={cn(
          "whitespace-nowrap",
          small ? "text-[10.5px]" : "text-[13.5px]",
          t === "bold" ? "font-site font-extrabold uppercase text-white site-wide" : cn(LOOK[t].heading, "text-site-ink"),
        )}
      >
        {b.name}
      </span>
    </span>
  );
}

function Kicker({ b, small = false }: { b: ShowcaseBusiness; small?: boolean }) {
  const t = b.template;
  const size = small ? "text-[7.5px]" : "text-[9.5px]";
  if (t === "bright") {
    return <span className={cn("inline-flex w-fit items-center rounded-[7px] font-semibold", small ? "h-[16px] px-[6px] text-[8px]" : "h-[20px] px-2 text-[10px]", tintOf(b).chip)}>{b.kicker}</span>;
  }
  if (t === "bold") {
    return (
      <span className={cn("flex items-center gap-2 font-bold uppercase tracking-[0.22em] text-white/85", size)}>
        <span className="h-[2px] w-5 shrink-0 bg-site-accent" />
        {b.kicker}
      </span>
    );
  }
  if (t === "trust") return <span className={cn("font-site-mono font-medium uppercase tracking-[0.12em] text-site-muted", size)}>{b.kicker}</span>;
  return <span className={cn("font-bold uppercase tracking-[0.18em] text-site-accent", size)}>{b.kicker}</span>;
}

function Buttons({ b, small = false }: { b: ShowcaseBusiness; small?: boolean }) {
  const look = LOOK[b.template];
  const category = CATEGORIES[b.category];
  const base = cn("inline-flex items-center justify-center whitespace-nowrap", look.btn, small ? "h-[28px] gap-[5px] px-3 text-[9px]" : "h-[32px] gap-[6px] px-[14px] text-[10.5px]");
  return (
    <div className={cn("flex", small ? "flex-col gap-[6px]" : "gap-2")}>
      <span className={cn(base, look.primary)}>
        <Icon name={category.ctaIcon} size={small ? 11 : 13} fill />
        {category.cta}
      </span>
      <span className={cn(base, look.outline)}>
        <Icon name={b.secondary.icon} size={small ? 11 : 13} />
        {b.secondary.label}
      </span>
    </div>
  );
}

/** A 720×450 desktop view of the business's site, browser bar included. */
export function DesktopSite({ b }: { b: ShowcaseBusiness }) {
  const t = b.template;
  const preset = PRESETS[t];
  const look = LOOK[t];
  const dark = preset.heroDark;
  const sizes = "(min-width: 1024px) 180px, 50vw";

  return (
    <div className="flex flex-col bg-white font-ui" style={{ width: DESKTOP.width, height: DESKTOP.height }}>
      <div className="flex h-[26px] shrink-0 items-center gap-[10px] border-b border-[#DFDCD3] bg-[#EDEBE5] px-[10px]">
        <span className="flex gap-[5px]">
          {[0, 1, 2].map((i) => <span key={i} className="h-[7px] w-[7px] rounded-full bg-[#D2CFC5]" />)}
        </span>
        <span className="mx-auto flex h-[16px] w-[260px] items-center justify-center gap-1 rounded-full bg-white font-mono text-[8.5px] text-muted">
          <Icon name="lock" size={9} fill className="text-success" />
          {HOST}/w/{b.slug}
        </span>
        <span className="w-[31px]" />
      </div>

      <div className={cn("relative flex-1 overflow-hidden", dark ? "bg-site-ink" : "bg-site-ground")} style={vars(presetStyle(preset))}>
        {t === "warm" ? (
          <Photo b={b} sizes={sizes} className="absolute top-[48px] right-0 bottom-[70px] w-[60%] [mask-image:linear-gradient(to_right,transparent,#000_40%)]" />
        ) : null}
        {t === "elegant" ? (
          <Photo b={b} sizes={sizes} className="absolute top-[48px] right-0 bottom-[70px] w-[52%] [mask-image:linear-gradient(to_right,transparent,#000_16%)]" />
        ) : null}
        {t === "bold" ? (
          <>
            <Photo b={b} sizes={sizes} className="absolute inset-0 bottom-[70px]" />
            <div className="absolute inset-0 bottom-[70px] bg-[linear-gradient(90deg,rgba(10,14,21,.97)_0%,rgba(10,14,21,.8)_38%,rgba(10,14,21,.05)_78%)]" />
          </>
        ) : null}
        {t === "trust" ? (
          <>
            <Photo b={b} sizes={sizes} className="absolute top-[60px] right-[26px] bottom-[84px] w-[48%] rounded-[12px]" />
            <span className="absolute bottom-[96px] left-[calc(52%-40px)] flex items-center gap-[6px] rounded-[8px] bg-white px-[10px] py-[7px] text-[9.5px] font-semibold text-site-ink shadow-[0_8px_20px_rgba(23,42,58,.14)]">
              <Icon name="verified" size={13} fill className="text-site-accent" />
              {b.features[0].line}
            </span>
          </>
        ) : null}
        {t === "bright" ? (
          <>
            <div className={cn("absolute top-[58px] right-[18px] bottom-[80px] w-[48%] rotate-[2.5deg] rounded-[22px]", tintOf(b).panel)} />
            <Photo b={b} sizes={sizes} className="absolute top-[64px] right-[30px] bottom-[88px] w-[46%] rounded-[16px]" />
            <span className={cn("absolute right-[46px] bottom-[102px] flex h-[22px] items-center gap-[5px] rounded-[8px] px-2 text-[9.5px] font-bold", tintOf(b, 2).chip)}>
              <Icon name="star" size={11} fill />
              4.9 · 120 reviews
            </span>
          </>
        ) : null}

        <div className={cn("absolute inset-x-0 top-0 z-10 flex h-[48px] items-center gap-5 px-[28px]", dark && "border-b border-white/10")}>
          <Mark b={b} />
          <nav className={cn("ml-auto flex gap-[18px] text-[9.5px] font-medium", dark ? "text-white/70" : "text-site-muted")}>
            {b.nav.map((n) => <span key={n}>{n}</span>)}
          </nav>
          <span className={cn("inline-flex h-[24px] items-center px-[10px] text-[9px] whitespace-nowrap", look.btn, look.primary)}>{CATEGORIES[b.category].cta}</span>
        </div>

        <div className={cn("absolute top-[48px] bottom-[70px] left-[30px] flex flex-col justify-center gap-[12px]", t === "bold" ? "w-[370px]" : "w-[318px]")}>
          <Kicker b={b} />
          <p className={cn("text-balance", look.heading, look.h1, dark ? "text-white" : "text-site-ink")}>{b.headline}</p>
          <p className={cn("max-w-[272px] text-[11.5px] leading-[1.55]", dark ? "text-white/72" : "text-site-muted")}>{b.lede}</p>
          <div className="mt-1">
            <Buttons b={b} />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 grid h-[70px] grid-cols-3 border-t border-site-line bg-white">
          {b.features.map((f, i) => (
            <div key={f.title} className="flex items-center gap-[10px] px-[28px]">
              <span className={cn("flex h-[30px] w-[30px] shrink-0 items-center justify-center", look.icon, t === "bright" && tintOf(b, i).panel)}>
                <Icon name={f.icon} size={15} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[10.5px] font-bold text-site-ink">{f.title}</span>
                <span className="truncate text-[9px] text-site-muted">{f.line}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A 220×452 phone showing the top of the same site. */
export function PhoneSite({ b }: { b: ShowcaseBusiness }) {
  const t = b.template;
  const preset = PRESETS[t];
  const look = LOOK[t];
  const dark = preset.heroDark;
  const sizes = "(min-width: 1024px) 100px, 40vw";

  return (
    <div className="rounded-[34px] bg-[#101318] p-[6px] font-ui ring-1 ring-white/10" style={{ width: PHONE.width, height: PHONE.height }}>
      <div className={cn("relative h-full overflow-hidden rounded-[28px]", dark ? "bg-site-ink" : "bg-site-ground")} style={vars(presetStyle(preset))}>
        <div className={cn("relative z-10 flex h-[26px] items-center justify-between px-[18px] text-[9px] font-semibold", dark ? "text-white" : "text-black")}>
          <span>9:41</span>
          <span className="absolute top-[6px] left-1/2 h-[15px] w-[58px] -translate-x-1/2 rounded-full bg-black" />
          <span className="flex items-end gap-[1.5px]">
            {[3, 5, 7, 9].map((h) => <span key={h} className="w-[2.5px] rounded-[1px] bg-current" style={{ height: h }} />)}
          </span>
        </div>
        <div className="relative z-10 flex h-[34px] items-center justify-between px-[12px]">
          <Mark b={b} small />
          <Icon name="menu" size={16} className={dark ? "text-white" : "text-site-ink"} />
        </div>

        {t === "bold" ? (
          <div className="relative -mt-[60px] h-[236px]">
            <Photo b={b} sizes={sizes} className="absolute inset-0" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,14,21,.55)_0%,rgba(10,14,21,.1)_40%,rgba(10,14,21,.95)_88%)]" />
            <div className="absolute inset-x-[12px] bottom-[6px] flex flex-col gap-[7px]">
              <Kicker b={b} small />
              <p className={cn("text-balance text-white", look.heading, look.ph1)}>{b.headline}</p>
            </div>
          </div>
        ) : (
          <div className="relative mx-[10px] mt-[2px] h-[140px]">
            {t === "bright" ? <div className={cn("absolute inset-0 translate-x-[4px] translate-y-[5px] rotate-[2deg] rounded-[16px]", tintOf(b).panel)} /> : null}
            <Photo
              b={b}
              sizes={sizes}
              className={cn(
                "absolute inset-0",
                t === "warm" && "-mx-[10px] rounded-none",
                t === "elegant" && "rounded-none",
                t === "trust" && "rounded-[10px]",
                t === "bright" && "rounded-[14px]",
              )}
            />
          </div>
        )}

        <div className={cn("flex flex-col px-[12px]", t === "bold" ? "gap-[9px] pt-[6px]" : "gap-[7px] pt-[12px]")}>
          {t === "bold" ? null : (
            <>
              <Kicker b={b} small />
              <p className={cn("text-balance text-site-ink", look.heading, look.ph1)}>{b.headline}</p>
            </>
          )}
          <p className={cn("line-clamp-3 text-[8.5px] leading-[1.5]", dark ? "text-white/72" : "text-site-muted")}>{b.lede}</p>
          <div className="mt-[2px]">
            <Buttons b={b} small />
          </div>
        </div>

        <span className={cn("absolute bottom-[5px] left-1/2 h-[3px] w-[64px] -translate-x-1/2 rounded-full", dark ? "bg-white/80" : "bg-black/80")} />
      </div>
    </div>
  );
}
