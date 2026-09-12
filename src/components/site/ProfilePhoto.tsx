import { cn } from "@/lib/cn";
import type { SiteImage as SiteImageData } from "@/lib/site/schema";
import { SiteImage } from "./SiteImage";

/**
 * Round photo of the person behind a person-led site (sales advisor, agent,
 * tutor...). Only rendered when the site has one — callers keep their existing
 * initial avatar or nothing otherwise, so there is never an empty frame.
 */
export function ProfilePhoto({
  image,
  name,
  size,
  className,
  priority,
}: {
  image: SiteImageData;
  name: string;
  /** Rendered size in px (the same on every breakpoint). */
  size: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cn("relative block shrink-0 overflow-hidden rounded-full bg-site-line ring-2", className)}
      style={{ width: size, height: size }}
    >
      <SiteImage image={{ ...image, alt: image.alt ?? name }} sizes={`${size}px`} priority={priority} className="object-top" />
    </span>
  );
}
