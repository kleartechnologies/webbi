"use client";

import { useState } from "react";
import { DataTable } from "@/components/admin/DataTable";
import { Pager, useCursorPager } from "@/components/admin/Pager";
import { LoadState, PageHeader, UserLink } from "@/components/admin/Panel";
import { YesNo } from "@/components/admin/StatusPill";
import { Button } from "@/components/ui";
import { useAdminData } from "@/lib/admin/client";
import { EMPTY, formatCount, formatDateTime, formatSen, providerLabel } from "@/lib/admin/format";
import type { listUsers } from "@/lib/admin/users";

type UsersPage = Awaited<ReturnType<typeof listUsers>>;

export function UsersView() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState<string | null>(null);
  const pager = useCursorPager(search ?? "");
  const params = new URLSearchParams({ limit: "25" });
  if (search) params.set("q", search);
  else if (pager.cursor) params.set("cursor", pager.cursor);
  const { data, error, loading, reload } = useAdminData<UsersPage>(`/api/admin/users?${params}`);

  return (
    <>
      <PageHeader title="Users" description="Accounts in Firebase Auth. Search needs the exact email address or UID." />
      <form
        role="search"
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(input.trim() || null);
        }}
      >
        <input
          name="q"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Exact email or UID"
          aria-label="Exact email or UID"
          autoComplete="off"
          className="h-9 min-w-0 flex-1 rounded-pill border border-line-input bg-surface px-4 text-[14px] outline-none focus:border-navy"
        />
        <Button type="submit" size="sm">
          Search
        </Button>
        {search ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setInput("");
              setSearch(null);
            }}
          >
            Clear
          </Button>
        ) : null}
      </form>
      {error ? <LoadState loading={false} error={error} onRetry={reload} /> : null}
      <DataTable
        label="Users"
        loading={loading}
        rows={data?.users}
        rowKey={(row) => row.uid}
        empty={search ? "No account has exactly that email or UID." : "No accounts yet."}
        columns={[
          { header: "Name", cell: (row) => row.name ?? EMPTY },
          { header: "Email", cell: (row) => <UserLink uid={row.uid} email={row.email} /> },
          { header: "Sign-in", cell: (row) => row.providers.map(providerLabel).join(", ") || EMPTY },
          { header: "Verified", cell: (row) => <YesNo value={row.emailVerified} /> },
          { header: "Created", cell: (row) => formatDateTime(row.createdAt) },
          { header: "Last sign-in", cell: (row) => formatDateTime(row.lastLoginAt) },
          { header: "Disabled", cell: (row) => <YesNo value={row.disabled} yesTone="danger" /> },
          { header: "Websites", cell: (row) => `${formatCount(row.websites)} (${formatCount(row.live)} live)`, className: "tabular-nums" },
          { header: "Paid", cell: (row) => (row.paidOrders ? `${formatSen(row.paidSen)} · ${row.paidOrders}` : EMPTY), className: "tabular-nums" },
        ]}
      />
      {search ? null : <Pager page={pager.page} nextCursor={data?.nextCursor} loading={loading} onPrev={pager.prev} onNext={pager.next} />}
    </>
  );
}
