import Image from "next/image";
import { cn } from "@/lib/cn";
import type { SiteImage as SiteImageData } from "@/lib/site/schema";

/** Emulator / localhost URLs can't go through the image optimizer. */
const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//;

/** Fills its (relative, sized) parent. */
export function SiteImage({
  image,
  sizes,
  priority,
  className,
  marker,
}: {
  image: SiteImageData;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** Names the image's role in the DOM (`data-image`), e.g. "cover" for the hero photo. */
  marker?: string;
}) {
  return (
    <Image
      src={image.url}
      alt={image.alt ?? ""}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={LOCAL.test(image.url)}
      className={cn("object-cover", className)}
      data-image={marker}
    />
  );
}
