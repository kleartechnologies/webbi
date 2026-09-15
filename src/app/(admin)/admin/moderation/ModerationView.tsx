"use client";

import { DataTable } from "@/components/admin/DataTable";
import { Pager, useCursorPager } from "@/components/admin/Pager";
import { LoadState, PageHeader, Panel, PublicLink, SiteLink, UserLink } from "@/components/admin/Panel";
import { SiteStatusPill, YesNo } from "@/components/admin/StatusPill";
import { useAdminData } from "@/lib/admin/client";
import { EMPTY, formatCount, formatDateTime } from "@/lib/admin/format";
import type { moderationList } from "@/lib/admin/moderation";

type ModerationPage = Awaited<ReturnType<typeof moderationList>>;

export function ModerationView() {
  const pager = useCursorPager("");
  const params = new URLSearchParams({ limit: "25" });
  if (pager.cursor) params.set("cursor", pager.cursor);
  const { data, error, loading, reload } = useAdminData<ModerationPage>(`/api/admin/moderation?${params}`);

  return (
    <>
      <PageHeader
        title="Moderation"
        description={
          <>
            Read only. Suspend or restore a website with <code>npm run ops:moderate</code>.
          </>
        }
      />
      {error ? <LoadState loading={false} error={error} onRetry={reload} /> : null}
      <Panel title={data ? `Suspended (${formatCount(data.suspendedCount)})` : "Suspended"} note="A suspended website's link shows a generic unavailable notice.">
        <DataTable
          label="Suspended websites"
          loading={loading}
          rows={data?.suspended}
          rowKey={(row) => row.siteId}
          empty="No website is suspended."
          columns={[
            { header: "Website", cell: (row) => <SiteLink id={row.siteId} name={row.site?.businessName ?? row.siteId} /> },
            { header: "Owner", cell: (row) => <UserLink uid={row.site?.ownerUid ?? null} email={row.site?.ownerEmail ?? null} /> },
            { header: "Reason", cell: (row) => row.reason ?? EMPTY, className: "max-w-[320px] whitespace-normal" },
            { header: "Suspended", cell: (row) => formatDateTime(row.suspendedAt) },
            { header: "Paid", cell: (row) => (row.site ? <YesNo value={row.site.paid} /> : EMPTY) },
            { header: "Status", cell: (row) => (row.site ? <SiteStatusPill status={row.site.status} /> : EMPTY) },
            { header: "Link", cell: (row) => <PublicLink path={row.publicPath}>{row.publicPath}</PublicLink> },
          ]}
        />
        <Pager page={pager.page} nextCursor={data?.nextCursor} loading={loading} onPrev={pager.prev} onNext={pager.next} />
      </Panel>
      <Panel title="Recently restored">
        <DataTable
          label="Recently restored websites"
          loading={loading}
          rows={data?.recentlyRestored}
          rowKey={(row) => row.siteId}
          empty="No website has been restored."
          columns={[
            { header: "Website", cell: (row) => <SiteLink id={row.siteId} name={row.site?.businessName ?? row.siteId} /> },
            { header: "Owner", cell: (row) => <UserLink uid={row.site?.ownerUid ?? null} email={row.site?.ownerEmail ?? null} /> },
            { header: "Suspended", cell: (row) => formatDateTime(row.suspendedAt) },
            { header: "Restored", cell: (row) => formatDateTime(row.restoredAt) },
          ]}
        />
      </Panel>
    </>
  );
}
