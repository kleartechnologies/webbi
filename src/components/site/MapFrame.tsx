"use client";

import { useEffect, useState } from "react";

/** How long an address has to stay unchanged in the editor before the map follows it. */
const SETTLE_MS = 700;

/**
 * The keyless Google Maps iframe. `src` always comes from resolveLocation()
 * (https://www.google.com/maps?q=…&output=embed, the only origin the CSPs allow
 * in frame-src), never from customer input directly. The server renders it
 * as-is; while an owner types an address in the editor, the frame waits for
 * the text to settle instead of reloading Google Maps on every keystroke.
 */
export function MapFrame({ src, title }: { src: string; title: string }) {
  const [shown, setShown] = useState(src);

  useEffect(() => {
    if (src === shown) return;
    const t = window.setTimeout(() => setShown(src), SETTLE_MS);
    return () => clearTimeout(t);
  }, [src, shown]);

  return (
    <iframe
      src={shown}
      title={title}
      data-site-map
      className="absolute inset-0 h-full w-full border-0"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  );
}
