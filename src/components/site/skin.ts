import type { TemplateId } from "@/lib/site/templates";

/**
 * The fixed look of each template, as Tailwind class lists taken from the
 * approved designs (Webbi {Warm,Elegant,Bold,Trust,Bright} Template). Only
 * Webbi's own classes live here: nothing a site owner types ever becomes a
 * class or a style. Components combine these with per-template structure.
 */
export interface Skin {
  id: TemplateId;
  /** Extra classes on the renderer root: body face and background texture. */
  root: string;
  /** Page width and side gutter shared by header, sections and footer. */
  container: string;
  /** Vertical rhythm of a plain section. */
  sectionY: string;
  /** Display face treatment for every heading. */
  heading: string;
  /** Section title size. */
  h2: string;
  /** Eyebrow over a section title (shape and type). */
  kicker: string;
  /** The eyebrow's colour on the light ground. */
  kickerTone: string;
  /** Short text under a section title. */
  note: string;
  /** Running text. */
  body: string;
  /** Button shape (height, radius, type). */
  btn: string;
  /** Filled button on the template's light ground. */
  btnPrimary: string;
  /** Outline button on the template's light ground. */
  btnOutline: string;
  /** WhatsApp buttons in WhatsApp green (Warm) rather than the template's own buttons. */
  whatsappGreen: boolean;
  /** Raised surface for cards and panels. */
  card: string;
  /** Corner radius of photos. */
  media: string;
  /** Price text. */
  price: string;
  /** Small label (hours heading, footer columns, facts). */
  label: string;
}

export const SKINS: Record<TemplateId, Skin> = {
  warm: {
    id: "warm",
    root: "font-ui site-grain",
    container: "max-w-[1120px] px-5 @3xl:px-8",
    sectionY: "py-12 @3xl:py-[88px]",
    heading: "font-site font-bold tracking-[-0.01em]",
    h2: "text-[30px] leading-[1.1] @3xl:text-[40px]",
    kicker: "text-[11px] font-bold uppercase tracking-[0.18em] @3xl:text-[12px]",
    kickerTone: "text-site-accent",
    note: "text-[15px] leading-[1.6] text-site-muted @3xl:text-[17px]",
    body: "text-[15px] leading-[1.65] text-site-muted @3xl:text-[17px]",
    btn: "inline-flex h-[52px] items-center justify-center gap-[10px] rounded-pill px-6 text-[15px] font-bold @3xl:h-14 @3xl:text-[16px]",
    btnPrimary: "bg-site-accent text-white",
    btnOutline: "border-[1.5px] border-site-ink text-site-ink",
    whatsappGreen: true,
    card: "rounded-[14px] border border-site-line bg-white",
    media: "rounded-[4px]",
    price: "font-bold text-site-accent",
    label: "text-[11px] font-bold uppercase tracking-[0.18em] text-[#8A6E57]",
  },
  elegant: {
    id: "elegant",
    root: "font-ui",
    container: "max-w-[1152px] px-5 @3xl:px-10",
    sectionY: "py-14 @3xl:py-[104px]",
    heading: "font-site font-normal",
    h2: "text-[28px] leading-[1.14] @3xl:text-[38px] @3xl:leading-[1.12]",
    kicker: "text-[10px] font-semibold uppercase tracking-[0.24em] @3xl:text-[11px]",
    kickerTone: "text-site-accent",
    note: "text-[14px] leading-[1.7] text-[#6B5C60] @3xl:text-[15px]",
    body: "text-[15px] leading-[1.7] text-[#4A3C40] @3xl:text-[17px] @3xl:leading-[1.75]",
    btn: "inline-flex h-[50px] items-center justify-center gap-[10px] rounded-none px-7 text-[14px] font-semibold tracking-[0.04em] transition-colors @3xl:h-[54px]",
    btnPrimary: "bg-site-ink text-site-ground hover:bg-site-accent",
    btnOutline: "border border-[#C7B6B1] text-site-ink hover:bg-[#EFE6E1]",
    whatsappGreen: false,
    card: "border border-site-line bg-white/60",
    media: "rounded-none",
    price: "text-[14px] font-semibold text-site-ink @3xl:text-[15px]",
    label: "text-[10px] font-bold uppercase tracking-[0.2em] text-site-muted @3xl:text-[11px]",
  },
  bold: {
    id: "bold",
    root: "font-site",
    container: "max-w-[1280px] px-5 @3xl:px-12 @6xl:px-20",
    sectionY: "py-14 @3xl:py-[120px]",
    heading: "font-site font-extrabold uppercase site-wide",
    h2: "text-[42px] leading-[0.92] @3xl:text-[56px] @3xl:leading-[0.96]",
    kicker:
      "flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.26em] site-wider before:h-[2px] before:w-8 before:shrink-0 before:bg-site-accent before:content-['']",
    kickerTone: "text-[#B81E10]",
    note: "text-[16px] leading-[1.6] text-[#2A3038] @3xl:text-[18px]",
    body: "text-[16px] leading-[1.7] text-[#2A3038] @3xl:text-[18px]",
    btn: "inline-flex h-14 items-center justify-center gap-[10px] rounded-none px-7 text-[14px] font-extrabold uppercase tracking-[0.07em] @3xl:h-[60px] @3xl:text-[15px]",
    btnPrimary: "bg-site-accent text-white",
    btnOutline: "border-2 border-site-ink text-site-ink",
    whatsappGreen: false,
    card: "border border-site-line bg-white",
    media: "rounded-none",
    price: "font-extrabold text-site-ink",
    label: "text-[10px] font-bold uppercase tracking-[0.2em] text-[#6E7682]",
  },
  trust: {
    id: "trust",
    root: "font-ui",
    container: "max-w-[1440px] px-5 @3xl:px-10 @6xl:px-20",
    sectionY: "py-9 @3xl:py-10",
    heading: "font-site font-bold tracking-[-0.02em]",
    h2: "text-[21px] leading-[1.2] @3xl:text-[26px]",
    kicker: "font-site-mono text-[10.5px] font-medium uppercase tracking-[0.14em] @3xl:text-[11px]",
    kickerTone: "text-site-muted",
    note: "text-[14px] leading-[1.55] text-site-muted",
    body: "text-[16px] leading-[1.6] text-[#40525E] @3xl:text-[18px]",
    btn: "inline-flex h-[52px] items-center justify-center gap-[10px] rounded-[8px] px-6 text-[15px] font-semibold @3xl:h-[54px]",
    btnPrimary: "bg-site-accent text-white",
    btnOutline: "border-[1.5px] border-site-ink bg-white text-site-ink",
    whatsappGreen: false,
    card: "rounded-[12px] border border-site-line bg-white",
    media: "rounded-[12px]",
    price: "font-site-mono font-semibold text-site-ink",
    label: "font-site-mono text-[10px] font-medium uppercase tracking-[0.12em] text-site-muted",
  },
  bright: {
    id: "bright",
    root: "font-ui",
    container: "max-w-[1440px] px-[22px] @3xl:px-12 @6xl:px-[120px]",
    sectionY: "py-12 @3xl:py-[76px]",
    heading: "font-site font-bold tracking-[-0.025em]",
    h2: "text-[30px] leading-[1.1] @3xl:text-[42px]",
    kicker: "inline-flex h-7 w-fit items-center rounded-[10px] px-3 text-[13px] font-semibold @3xl:h-8 @3xl:text-[13.5px]",
    kickerTone: "",
    note: "text-[16px] leading-[1.65] text-[#4C5C67] @3xl:text-[17.5px]",
    body: "text-[16px] leading-[1.7] text-[#4C5C67] @3xl:text-[18.5px]",
    btn: "inline-flex h-[54px] items-center justify-center gap-[10px] rounded-[14px] px-6 text-[16px] font-bold @3xl:h-14",
    btnPrimary: "bg-site-accent text-white",
    btnOutline: "border-[1.5px] border-site-ink text-site-ink",
    whatsappGreen: false,
    card: "rounded-[20px] border border-site-line bg-white",
    media: "rounded-[14px]",
    price: "font-bold text-site-ink",
    label: "text-[13.5px] font-bold text-site-ink",
  },
};

/** Bright's four soft tints, cycled through chips and marks (sky, green, coral, yellow). */
export const BRIGHT_TINTS = [
  { chip: "bg-[#E8F5FA] text-[#2C5468]", mark: "bg-[#8CC9E8]", panel: "bg-[#E8F5FA]" },
  { chip: "bg-[#EDF7EC] text-[#3D5240]", mark: "bg-[#9CCB9A]", panel: "bg-[#EDF7EC]" },
  { chip: "bg-[#FDEEE7] text-[#7A4430]", mark: "bg-[#F29A7A]", panel: "bg-[#FDEEE7]" },
  { chip: "bg-[#FFF7D9] text-[#6B5A21]", mark: "bg-[#E8C95A]", panel: "bg-[#FFF7D9]" },
] as const;

export const brightTint = (index: number) => BRIGHT_TINTS[((index % BRIGHT_TINTS.length) + BRIGHT_TINTS.length) % BRIGHT_TINTS.length];
