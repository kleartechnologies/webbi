import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { NavItem, RenderCtx } from "./context";

/** Full-width primary button under the hero (bold preset keeps it inside the hero). */
export function PrimaryCta({ ctx }: { ctx: RenderCtx }) {
  const { primary, target, rel } = ctx;
  if (!primary.href) return null;
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 pt-4 @3xl:px-8 @3xl:pt-6" data-hero-cta>
      <a
        href={primary.href}
        target={target}
        rel={rel}
        className={cn(
          "flex h-[54px] w-full items-center justify-center gap-[10px] rounded-pill text-[17px] font-bold text-white @3xl:inline-flex @3xl:w-auto @3xl:px-8",
          primary.green ? "bg-whatsapp" : "bg-site-accent",
        )}
      >
        <Icon name={primary.icon} size={24} fill={primary.icon === "chat"} />
        {primary.label}
      </a>
    </div>
  );
}

/** Icon row of in-page anchors. Desktop uses the header nav instead. */
export function QuickNav({ items }: { items: NavItem[] }) {
  if (items.length < 2) return null;
  return (
    <nav className="mx-auto flex w-full max-w-[1120px] gap-2 px-4 pt-4 @3xl:hidden" aria-label="Quick links">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="flex flex-1 flex-col items-center gap-[6px] rounded-card py-[10px] text-center text-[12px] font-bold leading-tight text-site-ink hover:bg-black/[.04]"
        >
          <Icon name={item.icon} size={26} className="text-site-accent" />
          {item.label}
        </a>
      ))}
    </nav>
  );
}
