import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { RenderCtx } from "./context";

/** Bottom bar: primary CTA plus a round secondary (chat or call). */
export function StickyCta({ ctx }: { ctx: RenderCtx }) {
  const { primary, chat, call, mode, strings, preset, target, rel } = ctx;
  if (!primary.href) return null;
  const dark = preset.heroDark;

  const secondary: { href: string; icon: IconName; green: boolean; label: string } | null = primary.green
    ? call
      ? { href: call, icon: "call", green: false, label: strings.call }
      : null
    : chat
      ? { href: chat, icon: "chat", green: true, label: strings.whatsapp }
      : call
        ? { href: call, icon: "call", green: false, label: strings.call }
        : null;

  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 mt-auto border-t backdrop-blur-md",
        dark ? "border-white/10 text-white" : "border-site-line text-site-ink",
        mode === "public" ? "pb-[max(14px,env(safe-area-inset-bottom))]" : "pb-[14px]",
      )}
      style={{ background: dark ? "color-mix(in srgb, var(--site-ink) 92%, transparent)" : "color-mix(in srgb, var(--site-ground) 92%, transparent)" }}
    >
      <div className="mx-auto flex w-full max-w-[560px] gap-[10px] px-4 pt-[10px]">
        <a
          href={primary.href}
          target={target}
          rel={rel}
          className={cn("flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2 rounded-pill px-4 text-[16px] font-bold text-white", primary.green ? "bg-whatsapp" : "bg-site-accent")}
        >
          <Icon name={primary.icon} size={22} fill={primary.icon === "chat"} />
          <span className="truncate">{primary.label}</span>
        </a>
        {secondary ? (
          <a
            href={secondary.href}
            target={target}
            rel={rel}
            aria-label={secondary.label}
            className={cn(
              "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-pill",
              secondary.green ? "bg-whatsapp text-white" : "border-[1.5px] border-current",
            )}
          >
            <Icon name={secondary.icon} size={22} fill={secondary.green} />
          </a>
        ) : null}
      </div>
    </div>
  );
}
