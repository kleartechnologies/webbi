import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PillTone = "success" | "danger" | "warning" | "info" | "neutral";

const TONES: Record<PillTone, string> = {
  success: "bg-success-tint text-success",
  danger: "bg-danger-tint text-danger",
  warning: "bg-amber/20 text-ink",
  info: "bg-navy-tint text-navy",
  neutral: "border border-line bg-ground text-muted",
};

export function StatusPill({ tone = "neutral", children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-pill px-2.5 py-0.5 text-[12px] font-bold", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function YesNo({ value, yes = "Yes", no = "No", yesTone = "success" }: { value: boolean; yes?: string; no?: string; yesTone?: PillTone }) {
  return value ? <StatusPill tone={yesTone}>{yes}</StatusPill> : <StatusPill>{no}</StatusPill>;
}

export function SiteStatusPill({ status }: { status: string }) {
  if (status === "published") return <StatusPill tone="success">Live</StatusPill>;
  if (status === "draft") return <StatusPill>Draft</StatusPill>;
  return <StatusPill tone="warning">Unknown</StatusPill>;
}

export function ModerationPill({ status }: { status: string }) {
  return status === "suspended" ? <StatusPill tone="danger">Suspended</StatusPill> : <StatusPill>Active</StatusPill>;
}

export function PaymentStatusPill({ payment }: { payment: { status: string; needsAttention: boolean; needsRefund: boolean } }) {
  if (payment.needsRefund) return <StatusPill tone="danger">Needs refund</StatusPill>;
  if (payment.needsAttention) return <StatusPill tone="warning">Paid, not live</StatusPill>;
  if (payment.status === "paid") return <StatusPill tone="success">Paid</StatusPill>;
  if (payment.status === "pending") return <StatusPill tone="info">Pending</StatusPill>;
  if (payment.status === "failed") return <StatusPill tone="danger">Failed</StatusPill>;
  return <StatusPill tone="warning">Unknown</StatusPill>;
}
