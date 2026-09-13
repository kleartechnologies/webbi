import { getCategory, type HeroMode } from "./categories";
import type { HeroImagePosition, SectionOf, SiteContent, SiteImage } from "./schema";

/** Broad shape of a cover photo, from its natural width ÷ height. */
export type HeroShape = "banner" | "wide" | "landscape" | "square" | "portrait" | "tall";

/**
 * How the cover and the copy are composed on each breakpoint. "overlay" puts
 * the copy on the photo (the photo is the hero backdrop); "split" sets the
 * whole, uncropped photo beside the copy; "stack" puts the copy under it.
 */
export type HeroDesktopLayout = "overlay" | "split";
export type HeroMobileLayout = "overlay" | "stack";

/**
 * The cover photo's frame, derived from the photo itself so that nothing is
 * cropped just because a layout has a fixed box. Ratios are width ÷ height.
 */
export interface HeroFrame {
  /** Natural ratio when the upload recorded its size; undefined for older photos. */
  ratio?: number;
  shape: HeroShape;
  desktop: HeroDesktopLayout;
  mobile: HeroMobileLayout;
  /** aspect-ratio of the frame on small screens (the photo is cropped only when this differs from `ratio`). */
  mobileRatio: number;
  /** aspect-ratio of the frame on wide screens; equals `ratio` exactly for the split layout. */
  desktopRatio: number;
}

/**
 * What the hero shows, resolved the same way for the public site, the
 * previews and the editor so they can never disagree.
 */
export interface ResolvedHero {
  /** Cover photo, or undefined when the category fallback should render. */
  image?: SiteImage;
  position: HeroImagePosition;
  mode: HeroMode;
  /** Frame for `image`; present exactly when `image` is. */
  frame?: HeroFrame;
}

/**
 * The owner's dedicated cover photo wins. Sites built before it existed keep
 * their first uploaded photo as the cover. Never the logo or profile photo.
 */
export function heroImageOf(site: SiteContent, section?: SectionOf<"hero">): SiteImage | undefined {
  return site.business.heroImage ?? section?.image;
}

/** The AI's choice for this site, else the category default. */
export function heroModeOf(site: SiteContent, section?: SectionOf<"hero">): HeroMode {
  return section?.presentationMode ?? getCategory(site.business.category).heroMode;
}

/** Natural width ÷ height, or undefined when the photo's size was never recorded. */
export function imageRatio(image: Pick<SiteImage, "width" | "height">): number | undefined {
  const { width, height } = image;
  return width && height && width > 0 && height > 0 ? width / height : undefined;
}

/**
 * Photos of unknown size (uploaded before sizes were stored) are laid out as
 * the recommended 16:9 cover, the shape the previous fixed-box heroes assumed.
 */
export const UNKNOWN_RATIO = 16 / 9;

/** Shape thresholds, widest first. Anything narrower than the last one is "tall". */
const SHAPES: ReadonlyArray<readonly [number, HeroShape]> = [
  [2.4, "banner"], // 2.5:1, 3:1 site banners
  [1.6, "wide"], // 16:10, 16:9, 2:1, 21:9
  [1.15, "landscape"], // 5:4, 4:3, 3:2
  [0.87, "square"],
  [0.6, "portrait"], // 4:5, 3:4, 2:3
];

export function heroShapeOf(ratio: number): HeroShape {
  return SHAPES.find(([min]) => ratio >= min)?.[1] ?? "tall";
}

/**
 * Frame bounds. Within them the frame takes the photo's own ratio, so the
 * photo is shown whole; outside them the photo is cropped by the smallest
 * amount that keeps the hero usable (never shorter than a strip, never longer
 * than a screen). Heights are additionally capped in CSS (see Hero.tsx).
 */
export const HERO_BOUNDS = {
  /** Copy over the bottom of the photo: from 2:3 (a tall phone photo, lightly cropped) to just under square. */
  mobileOverlay: { min: 2 / 3, max: 1.15 },
  /** Copy under the photo: from 3:4 up to 2:1, so the copy still fits on the first screen. */
  mobileStack: { min: 3 / 4, max: 2 },
  /** Full-width backdrop on wide screens: from 16:10 (already needs the height cap) to a 3.2:1 strip. */
  desktopOverlay: { min: 1.6, max: 3.2 },
} as const;

const clamp = (value: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, value));

/**
 * Decide the composition from the photo's shape and the hero's mode:
 * - wide and banner photos are the full-width hero on desktop, with the copy over their lower part;
 * - landscape, square, portrait and tall photos sit whole beside the copy on desktop, height-capped;
 * - on phones a visual hero overlays the copy on square/portrait/tall photos (which have the room)
 *   and stacks the copy under wider ones; person, service and property heroes always stack,
 *   because their identity, proof points and buttons need the ground.
 */
export function heroFrameOf(image: Pick<SiteImage, "width" | "height">, mode: HeroMode): HeroFrame {
  const ratio = imageRatio(image);
  const natural = ratio ?? UNKNOWN_RATIO;
  const shape = heroShapeOf(natural);
  const desktop: HeroDesktopLayout = natural >= HERO_BOUNDS.desktopOverlay.min ? "overlay" : "split";
  const mobile: HeroMobileLayout = mode === "visual" && natural <= HERO_BOUNDS.mobileOverlay.max ? "overlay" : "stack";
  return {
    ratio,
    shape,
    desktop,
    mobile,
    mobileRatio: clamp(natural, mobile === "overlay" ? HERO_BOUNDS.mobileOverlay : HERO_BOUNDS.mobileStack),
    desktopRatio: desktop === "overlay" ? clamp(natural, HERO_BOUNDS.desktopOverlay) : natural,
  };
}

export function resolveHero(site: SiteContent, section?: SectionOf<"hero">): ResolvedHero {
  const image = heroImageOf(site, section);
  const mode = heroModeOf(site, section);
  return {
    image,
    position: site.business.heroImagePosition ?? "center",
    mode,
    frame: image ? heroFrameOf(image, mode) : undefined,
  };
}

/** object-position class for a cover photo wherever a frame bound forces a crop. */
export const HERO_POSITION_CLASS: Record<HeroImagePosition, string> = {
  center: "object-center",
  top: "object-top",
  bottom: "object-bottom",
};
