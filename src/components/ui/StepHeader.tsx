"use client";

import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

interface StepHeaderProps {
  step: number;
  total: number;
  /** Where "back" goes. Defaults to browser history. */
  backHref?: string;
  onBack?: () => void;
  backLabel?: string;
}

export function StepHeader({ step, total, backHref, onBack, backLabel = "Back" }: StepHeaderProps) {
  const router = useRouter();
  const pct = Math.max(0, Math.min(100, (step / total) * 100));
  const goBack = () => {
    if (onBack) return onBack();
    if (backHref) return router.push(backHref);
    router.back();
  };
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface px-3 py-[10px]">
      <button type="button" onClick={goBack} aria-label={backLabel} className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-ground">
        <Icon name="arrow_back" size={24} />
      </button>
      <div className="flex flex-1 flex-col gap-2">
        <span className="text-[13px] font-bold text-muted">
          Step {step} of {total}
        </span>
        <div className="h-1 w-full overflow-hidden rounded-[2px] bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step}>
          <div className="h-full rounded-[2px] bg-navy transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
