import { cn } from "@/lib/cn";
import { socialLinks } from "@/lib/site/links";
import { findSection, type RenderCtx } from "./context";
import { SocialIcon } from "./SocialIcon";

export type SocialPlacement = "about" | "contact" | "footer";

/**
 * Where the icons live, once per site: beside the person's story for
 * person-led businesses, in the contact section for business-led ones, and
 * in the footer when a site has neither.
 */
export function socialPlacement(ctx: RenderCtx): SocialPlacement {
  const { site, category } = ctx;
  if (category.personLed && findSection(site, "about")) return "about";
  if (findSection(site, "contact")) return "contact";
  return "footer";
}

/**
 * Round icon buttons for the site's valid social profiles. Renders nothing at
 * all when none normalise to a safe URL, so there is never an empty row.
 * Links always open in a new tab: customers leave the site to follow.
 */
export function SocialLinks({ ctx, at, label, className, dark }: { ctx: RenderCtx; at: SocialPlacement; label?: string; className?: string; dark?: boolean }) {
  const links = socialLinks(ctx.site.business);
  if (!links.length || socialPlacement(ctx) !== at) return null;
  return (
    <div className={cn("flex items-center gap-3", className)} data-social>
      {label ? <span className={cn("text-[13px] font-semibold", dark ? "text-white/80" : "text-site-muted")}>{label}</span> : null}
      <ul className="flex items-center gap-2" aria-label={ctx.strings.socialMedia}>
        {links.map((link) => (
          <li key={link.kind}>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={link.label}
              title={link.label}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] transition-colors",
                dark ? "border-white/30 text-white hover:bg-white/10" : "border-site-line bg-white text-site-ink hover:border-site-ink",
              )}
            >
              <SocialIcon kind={link.kind} size={20} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
