import type { ReactNode } from "react";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Minimal browser top bar for the example-site frames. */
export function BrowserChrome({ url, size = "md", secure = false, right }: { url: string; size?: "sm" | "md"; secure?: boolean; right?: ReactNode }) {
  const sm = size === "sm";
  return (
    <div className={cn("flex items-center gap-3", sm ? "bg-surface px-3 py-[9px]" : "border-b border-[#DFDCD3] bg-[#EDEBE5] px-[14px] py-[11px]")}>
      <span className="flex gap-[6px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("rounded-full", sm ? "h-[9px] w-[9px] bg-[#E6E4DC]" : "h-[10px] w-[10px] bg-[#D2CFC5]")} />
        ))}
      </span>
      <span className={cn("flex min-w-0 flex-1 items-center gap-[6px] truncate rounded-pill font-mono text-muted", sm ? "h-6 bg-ground px-[10px] text-[11px]" : "h-7 bg-surface px-3 text-[12px]")}>
        {secure ? <Icon name="lock" size={14} fill className="shrink-0 text-success" /> : null}
        <span className="truncate">{url}</span>
      </span>
      {right}
    </div>
  );
}
