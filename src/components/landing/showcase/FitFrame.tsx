"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Scales a drawing made at `width` px to this frame's width. The CSS formula
 * covers the first paint; the measured scale replaces it once hydrated, because
 * iOS Safari resolves tan(atan2()) with container units wrongly (the drawing
 * came out flipped and oversized). Same approach as SitePreview.
 */
export function FitFrame({ width, className, children }: { width: number; className: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = box.current;
    const target = inner.current;
    if (!el || !target) return;
    const fit = () => {
      target.style.transform = `scale(${el.clientWidth / width})`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={box} className={`@container ${className}`}>
      <div ref={inner} className="absolute top-0 left-0 origin-top-left" style={{ transform: `scale(tan(atan2(100cqw, ${width}px)))` }}>
        {children}
      </div>
    </div>
  );
}
