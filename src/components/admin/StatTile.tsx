import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function StatTile({ label, value, hint, alert = false }: { label: string; value: ReactNode; hint?: ReactNode; alert?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-card border bg-surface p-4", alert ? "border-danger" : "border-line")}>
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</span>
      <strong className={cn("text-[20px] leading-tight tabular-nums [overflow-wrap:anywhere] sm:text-[24px]", alert ? "text-danger" : "text-ink")}>
        {value}
      </strong>
      {hint ? <span className="text-[12px] text-muted">{hint}</span> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}
