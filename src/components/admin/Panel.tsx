"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button, Chip, Spinner } from "@/components/ui";
import { EMPTY } from "@/lib/admin/format";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[26px] leading-tight tracking-[-0.02em]">{title}</h1>
        {description ? <p className="text-[14px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, note, actions, children }: { title: string; note?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-bold">{title}</h2>
        {actions}
      </div>
      {note ? <p className="text-[13px] text-muted">{note}</p> : null}
      {children}
    </section>
  );
}

export function FactList({ items }: { items: [label: string, value: ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-card border border-line bg-surface p-4 text-[14px] sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</dt>
          <dd className="text-ink [overflow-wrap:anywhere]">{value ?? EMPTY}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LoadState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry?: () => void }) {
  if (error) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-danger-tint p-4 text-[14px] font-semibold text-danger">
        <span>{error}</span>
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex justify-center py-10 text-navy">
        <Spinner size={26} />
      </div>
    );
  }
  return null;
}

export function FilterBar<V extends string>({ label, options, value, onChange }: { label: string; options: readonly (readonly [V, string])[]; value: V; onChange: (value: V) => void }) {
  return (
    <div role="group" aria-label={label} className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1">
      {options.map(([option, text]) => (
        <Chip key={option} selected={option === value} onClick={() => onChange(option)} data-filter={option}>
          {text}
        </Chip>
      ))}
    </div>
  );
}

export function UserLink({ uid, email }: { uid: string | null; email: string | null }) {
  if (!uid) return <span className="text-muted">{EMPTY}</span>;
  return (
    <Link href={`/admin/users/${encodeURIComponent(uid)}`} className="font-semibold text-navy hover:underline">
      {email ?? uid}
    </Link>
  );
}

export function SiteLink({ id, name }: { id: string | null; name?: string | null }) {
  if (!id) return <span className="text-muted">{EMPTY}</span>;
  return (
    <Link href={`/admin/sites/${encodeURIComponent(id)}`} className="font-semibold text-navy hover:underline">
      {name || "Untitled website"}
    </Link>
  );
}

/** A public page on Webbi, opened in a new tab as a full load (/w/ has its own security policy). */
export function PublicLink({ path, children }: { path: string | null; children: ReactNode }) {
  if (!path) return <span className="text-muted">{EMPTY}</span>;
  return (
    <a href={path} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy hover:underline">
      {children}
    </a>
  );
}

export function reasonLabel(reason: string | null): string {
  return reason ? reason.replace(/_/g, " ") : EMPTY;
}
