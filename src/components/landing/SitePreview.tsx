"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { cn } from "@/lib/cn";
import type { SiteContent } from "@/lib/site/schema";

/**
 * A real example site, rendered by the product's own SiteRenderer at a design
 * width and scaled into a clipped box. With `scale` omitted the site is fitted
 * to the box width (CSS ratio first, ResizeObserver keeps it exact). Mounted
 * lazily as the viewer approaches so the landing HTML stays light.
 */
export function SitePreview({
  site,
  width,
  scale,
  height,
  shift = 0,
  className,
  style,
}: {
  site: SiteContent;
  /** Viewport width the site is laid out at (e.g. 1280 desktop, 402 phone). */
  width: number;
  /** Fixed scale; omit to fit the box width. */
  scale?: number;
  height: number | string;
  /** Design-pixels to scroll the site up by, to show a lower section. */
  shift?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = window.setTimeout(() => setMounted(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: "900px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = box.current;
    const target = inner.current;
    if (!el || !target || scale !== undefined) return;
    const fit = () => {
      const s = el.clientWidth / width;
      target.style.transform = `scale(${s}) translateY(${-shift}px)`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scale, shift, width]);

  const transform = scale !== undefined ? `scale(${scale}) translateY(${-shift}px)` : `scale(tan(atan2(100cqw, ${width}px))) translateY(${-shift}px)`;

  return (
    <div ref={box} aria-hidden data-site-preview className={cn("@container relative overflow-hidden", className)} style={{ height, ...style }}>
      <div ref={inner} className="absolute top-0 left-0 origin-top-left" style={{ width, transform }}>
        {mounted ? <SiteRenderer site={site} mode="preview" stickyCta={false} /> : null}
      </div>
    </div>
  );
}
