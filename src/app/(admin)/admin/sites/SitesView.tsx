"use client";

import { useState } from "react";
import { DataTable } from "@/components/admin/DataTable";
import { Pager, useCursorPager } from "@/components/admin/Pager";
import { FilterBar, LoadState, PageHeader, SiteLink, UserLink } from "@/components/admin/Panel";
import { ModerationPill, SiteStatusPill } from "@/components/admin/StatusPill";
import { useAdminData } from "@/lib/admin/client";
import { EMPTY, formatDateTime } from "@/lib/admin/format";
import type { SiteFilter } from "@/lib/admin/schemas";
import type { listSites } from "@/lib/admin/sites";

type SitesPage = Awaited<ReturnType<typeof listSites>>;

const FILTERS = [
  ["all", "All"],
  ["draft", "Drafts"],
  ["published", "Live"],
  ["paid", "Paid"],
  ["suspended", "Suspended"],
  ["payment_pending", "Payment pending"],
  ["paid_not_live", "Paid, not live"],
] as const satisfies readonly (readonly [SiteFilter, string])[];

export function SitesView() {
  const [filter, setFilter] = useState<SiteFilter>("all");
  const pager = useCursorPager(filter);
  const params = new URLSearchParams({ filter, limit: "25" });
  if (pager.cursor) params.set("cursor", pager.cursor);
  const { data, error, loading, reload } = useAdminData<SitesPage>(`/api/admin/sites?${params}`);

  return (
    <>
      <PageHeader title="Websites" description="Newest activity first. Payment pending lists websites with an open bill." />
      <FilterBar label="Filter websites" options={FILTERS} value={filter} onChange={setFilter} />
      {error ? <LoadState loading={false} error={error} onRetry={reload} /> : null}
      <DataTable
        label="Websites"
        loading={loading}
        rows={data?.sites}
        rowKey={(row) => row.id}
        empty="No websites match."
        columns={[
          { header: "Business", cell: (row) => <SiteLink id={row.id} name={row.businessName} /> },
          { header: "Owner", cell: (row) => <UserLink uid={row.ownerUid} email={row.ownerEmail} /> },
          { header: "Category", cell: (row) => row.category ?? EMPTY },
          { header: "Template", cell: (row) => row.template ?? EMPTY },
          { header: "Status", cell: (row) => <SiteStatusPill status={row.status} /> },
          { header: "Created", cell: (row) => formatDateTime(row.createdAt) },
          { header: "Updated", cell: (row) => formatDateTime(row.updatedAt) },
          { header: "Published", cell: (row) => formatDateTime(row.publishedAt) },
          { header: "Moderation", cell: (row) => <ModerationPill status={row.moderationStatus} /> },
          { header: "Link", cell: (row) => (row.slug ? `/w/${row.slug}` : EMPTY) },
        ]}
      />
      <Pager page={pager.page} nextCursor={data?.nextCursor} loading={loading} onPrev={pager.prev} onNext={pager.next} />
    </>
  );
}
