"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui";
import { cn } from "@/lib/cn";

/** "Menu items · Hold to reorder" style heading with an optional right-hand note. */
export function SectionHeading({ title, note, children }: { title: string; note?: string; children?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-[20px] leading-[1.2] tracking-[-0.02em]">{title}</h2>
      {note ? <span className="shrink-0 text-[12px] text-muted">{note}</span> : children}
    </div>
  );
}

/** Settings row: uppercase label, value line and a trailing control. */
export function SettingsRow({
  label,
  value,
  trailing,
  onClick,
  disabled,
  className,
}: {
  label: string;
  value: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px] text-left">
        <span className="text-label font-bold uppercase text-muted">{label}</span>
        <span className="truncate text-[15px] leading-[1.3] text-ink">{value}</span>
      </div>
      {trailing}
    </>
  );
  const classes = cn(
    "flex w-full items-center gap-3 rounded-card border border-line bg-surface px-4 py-[14px]",
    disabled && "opacity-70",
    className,
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={cn(classes, "hover:border-navy")}>
        {body}
      </button>
    );
  }
  return <div className={classes}>{body}</div>;
}

/** Small round icon button used on item rows and photo tiles. */
export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  tone = "muted",
  className,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "muted" | "navy" | "danger";
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-30",
        tone === "danger" && "text-danger hover:bg-danger-tint",
        tone === "navy" && "text-navy hover:bg-navy-tint",
        tone === "muted" && "text-muted hover:bg-ground hover:text-ink",
        className,
      )}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

/** Pill badge, e.g. "Hero", "Live", "Not published". */
export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "amber" | "success" | "ink" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2 py-[3px] text-[11px] font-bold whitespace-nowrap",
        tone === "muted" && "bg-line text-muted",
        tone === "amber" && "bg-amber text-ink",
        tone === "success" && "bg-success-tint text-success",
        tone === "ink" && "bg-ink/75 text-white",
      )}
    >
      {children}
    </span>
  );
}
