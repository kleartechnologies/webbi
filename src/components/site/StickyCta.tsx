import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { RenderCtx } from "./context";

const glass = { background: "color-mix(in srgb, var(--site-ground) 94%, transparent)" };

/** Phone bottom bar: the primary CTA plus a secondary (chat or call), in each template's own buttons. */
export function StickyCta({ ctx }: { ctx: RenderCtx }) {
  const { primary, chat, call, mode, strings, template, skin, target, rel } = ctx;
  if (!primary.href) return null;

  const secondary: { href: string; icon: IconName; green: boolean; label: string } | null = primary.green
    ? call
      ? { href: call, icon: "call", green: false, label: strings.call }
      : null
    : chat
      ? { href: chat, icon: "chat", green: true, label: strings.whatsapp }
      : call
        ? { href: call, icon: "call", green: false, label: strings.call }
        : null;

  const shell = "sticky bottom-0 z-20 mt-auto @3xl:hidden";
  const safe = mode === "public" ? "pb-[max(12px,env(safe-area-inset-bottom))]" : "pb-3";
  const primaryIcon = <Icon name={primary.icon} size={22} fill={primary.icon === "chat"} />;

  if (template === "bold") {
    return (
      <div className={cn(shell, "grid bg-site-ink", secondary ? "grid-cols-2" : "grid-cols-1", mode === "public" && "pb-[env(safe-area-inset-bottom)]")}>
        <a href={primary.href} target={target} rel={rel} className="flex h-[60px] min-w-0 items-center justify-center gap-2 bg-site-accent px-3 text-[14px] font-extrabold uppercase tracking-[0.07em] text-white">
          {primaryIcon}
          <span className="truncate">{primary.label}</span>
        </a>
        {secondary ? (
          <a href={secondary.href} target={target} rel={rel} className="flex h-[60px] min-w-0 items-center justify-center gap-2 bg-[#F4F1EA] px-3 text-[14px] font-extrabold uppercase tracking-[0.07em] text-site-ink">
            <Icon name={secondary.icon} size={20} fill={secondary.green} />
            <span className="truncate">{secondary.label}</span>
          </a>
        ) : null}
      </div>
    );
  }

  const bar = {
    warm: { wrap: "border-t border-site-line backdrop-blur-md", main: cn("h-[52px] rounded-pill text-[16px] font-bold text-white", primary.green ? "bg-whatsapp" : "bg-site-accent"), side: "h-[52px] w-[52px] rounded-pill" },
    elegant: { wrap: "border-t border-site-line backdrop-blur-md", main: "h-[50px] bg-site-ink text-[14px] font-semibold tracking-[0.04em] text-site-ground", side: "h-[50px] w-[50px] border border-[#C7B6B1]" },
    trust: { wrap: "border-t border-site-line bg-white", main: "h-12 rounded-[8px] bg-site-accent text-[15px] font-semibold text-white", side: "h-12 w-12 rounded-[8px] border-[1.5px] border-site-line" },
    bright: { wrap: "backdrop-blur-md", main: "h-[50px] rounded-[13px] bg-site-accent text-[15px] font-bold text-white", side: "h-[50px] w-[120px] gap-2 rounded-[13px] border-[1.5px] border-site-ink text-[14px] font-bold" },
  }[template];

  return (
    <div className={cn(shell, bar.wrap, safe, "text-site-ink")} style={template === "trust" ? undefined : glass}>
      <div className={cn("mx-auto flex w-full max-w-[560px] gap-[10px] pt-3", skin.container)}>
        <a href={primary.href} target={target} rel={rel} className={cn("flex min-w-0 flex-1 items-center justify-center gap-2 px-4", bar.main)}>
          {primaryIcon}
          <span className="truncate">{primary.label}</span>
        </a>
        {secondary ? (
          <a
            href={secondary.href}
            target={target}
            rel={rel}
            aria-label={secondary.label}
            className={cn(
              "flex shrink-0 items-center justify-center",
              bar.side,
              template === "warm" && (secondary.green ? "bg-whatsapp text-white" : "border-[1.5px] border-site-ink"),
            )}
          >
            <Icon name={secondary.icon} size={22} fill={secondary.green && template === "warm"} />
            {template === "bright" ? <span>{secondary.green ? strings.whatsapp : strings.call}</span> : null}
          </a>
        ) : null}
      </div>
    </div>
  );
}
