import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { buttonClass, type NavItem, type RenderCtx } from "./context";
import { brightTint } from "./skin";

/** Primary button under the header when the site has its hero switched off (Bold keeps it in the hero). */
export function PrimaryCta({ ctx }: { ctx: RenderCtx }) {
  const { primary, target, rel, skin } = ctx;
  if (!primary.href) return null;
  return (
    <div className={cn("mx-auto w-full pt-6 @3xl:pt-8", skin.container)} data-hero-cta>
      <a href={primary.href} target={target} rel={rel} className={cn(buttonClass(ctx, "primary", primary.green), "w-full @md:w-auto @md:px-8")}>
        <Icon name={primary.icon} size={22} fill={primary.icon === "chat"} />
        {primary.label}
      </a>
    </div>
  );
}

const COLS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"] as const;
const COLS_DESKTOP = ["", "@3xl:grid-cols-1", "@3xl:grid-cols-2", "@3xl:grid-cols-3", "@3xl:grid-cols-4"] as const;

/**
 * The row of in-page anchors under the hero, drawn the way each template
 * draws it: Warm's icon strip, Elegant's hairline grid, Bold's red promise
 * band, Trust's link cards and Bright's tinted strip.
 */
export function QuickNav({ ctx, items }: { ctx: RenderCtx; items: NavItem[] }) {
  if (items.length < 2) return null;
  const { template, skin, strings } = ctx;
  const n = items.length;
  const label = "Quick links";

  if (template === "bold") {
    return (
      <nav className="bg-site-accent text-white" aria-label={label}>
        <div className={cn("mx-auto flex w-full flex-col gap-4 py-5 @3xl:min-h-24 @3xl:flex-row @3xl:items-center @3xl:gap-8 @3xl:py-4", skin.container)}>
          <ul className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 @3xl:gap-x-6">
            {items.map((item, i) => (
              <li key={item.href} className="flex items-center gap-4 @3xl:gap-6">
                {i > 0 ? <span aria-hidden className="h-2 w-2 shrink-0 bg-site-ink" /> : null}
                <a href={item.href} className="text-[19px] leading-none font-extrabold uppercase site-wide hover:text-site-ink @3xl:text-[22px]">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={items[0].href}
            className="inline-flex h-11 w-fit shrink-0 items-center gap-2 bg-site-ink px-5 text-[13px] font-extrabold uppercase tracking-[0.07em] text-white @3xl:ml-auto @3xl:h-[52px] @3xl:px-6"
          >
            {strings.browse}
            <Icon name="arrow_forward" size={18} />
          </a>
        </div>
      </nav>
    );
  }

  if (template === "elegant") {
    return (
      <nav className="border-y border-site-line" aria-label={label}>
        <div className={cn("mx-auto w-full px-0 @3xl:px-10", "max-w-[1152px]")}>
          <div className={cn("grid gap-px bg-site-line", n === 3 ? "grid-cols-3" : "grid-cols-2", COLS_DESKTOP[n])}>
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex min-w-0 items-center justify-between gap-2 bg-site-ground px-5 py-5 text-[14px] font-semibold transition-colors hover:bg-[#EFE6E1] @3xl:px-6 @3xl:py-6 @3xl:text-[15px]"
              >
                <span className="truncate">{item.label}</span>
                <Icon name="arrow_forward" size={16} className="shrink-0 text-site-accent" />
              </a>
            ))}
          </div>
        </div>
      </nav>
    );
  }

  if (template === "trust") {
    return (
      <nav aria-label={label}>
        <div className={cn("mx-auto grid w-full gap-3 pt-6 @3xl:pt-3", skin.container, n === 3 ? "grid-cols-1 @md:grid-cols-3" : "grid-cols-2", COLS_DESKTOP[n])}>
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex h-[52px] min-w-0 items-center justify-between gap-2 rounded-[10px] border border-site-line bg-white px-4 text-[14px] font-semibold transition-colors hover:border-site-ink @3xl:h-[58px] @3xl:px-5 @3xl:text-[15px]"
            >
              <span className="truncate">{item.label}</span>
              <Icon name="arrow_forward" size={18} className="shrink-0 text-site-accent" />
            </a>
          ))}
        </div>
      </nav>
    );
  }

  if (template === "bright") {
    return (
      <nav aria-label={label}>
        <div className={cn("mx-auto w-full pt-8 @3xl:pt-14", skin.container)}>
          <div className={cn("grid gap-x-6 border-t border-[#EDE7DA]", n === 3 ? "grid-cols-1 @md:grid-cols-3" : "grid-cols-2", COLS_DESKTOP[n])}>
            {items.map((item, i) => (
              <a key={item.href} href={item.href} className="flex min-w-0 items-center gap-3 py-4 text-[15px] font-bold @3xl:py-7 @3xl:text-[15.5px]">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]", brightTint(i).chip)}>
                  <Icon name={item.icon} size={20} />
                </span>
                <span className="truncate">{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      </nav>
    );
  }

  // Warm
  return (
    <nav className="border-b border-site-line" aria-label={label}>
      <div className={cn("mx-auto grid w-full", skin.container, COLS[n], "px-2")}>
        {items.map((item, i) => (
          <a
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-w-0 flex-col items-center gap-[6px] py-4 text-center text-[12px] font-bold leading-tight text-site-ink hover:text-site-accent @3xl:flex-row @3xl:gap-3 @3xl:px-[22px] @3xl:py-[22px] @3xl:text-left @3xl:text-[15px]",
              i > 0 && "@3xl:border-l @3xl:border-site-line",
            )}
          >
            <Icon name={item.icon} size={26} className="shrink-0 text-site-accent" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{item.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
