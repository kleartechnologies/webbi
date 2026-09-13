import Link from "next/link";
import { cn } from "@/lib/cn";

export function Wordmark({ href = "/", size = 22, className, label = "Webbi home" }: { href?: string | null; size?: number; className?: string; label?: string }) {
  const inner = (
    <span
      className={cn("inline-flex items-baseline font-display font-extrabold leading-none tracking-[-0.03em] text-navy", className)}
      style={{ fontSize: size }}
    >
      Webbi
      <span aria-hidden className="ml-[3px] inline-block rounded-full bg-amber" style={{ width: size * 0.27, height: size * 0.27 }} />
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} aria-label={label} className="inline-flex">
      {inner}
    </Link>
  );
}
