"use client";

import { DataTable } from "@/components/admin/DataTable";
import { LoadState, PageHeader, Panel, SiteLink, UserLink } from "@/components/admin/Panel";
import { StatGrid, StatTile } from "@/components/admin/StatTile";
import type { aiUsage } from "@/lib/admin/ai";
import { useAdminData } from "@/lib/admin/client";
import { formatAgainstLimit, formatCount, formatDateTime } from "@/lib/admin/format";

type AiUsage = Awaited<ReturnType<typeof aiUsage>>;
type SiteUsage = AiUsage["topSites"][number];
type AccountUsage = AiUsage["topAccountsToday"][number];

export function AiView() {
  const { data, error, loading, reload } = useAdminData<AiUsage>("/api/admin/ai");

  const siteColumns = (limits: AiUsage["siteLimits"]) => [
    { header: "Website", cell: (row: SiteUsage) => <SiteLink id={row.siteId} name={row.businessName} /> },
    { header: "Owner", cell: (row: SiteUsage) => <UserLink uid={row.ownerUid} email={row.ownerEmail} /> },
    { header: "Understand", cell: (row: SiteUsage) => `${row.understandings} of ${limits.understand}`, className: "tabular-nums" },
    { header: "Generate", cell: (row: SiteUsage) => `${row.generations} of ${limits.generate}`, className: "tabular-nums" },
    { header: "Last used", cell: (row: SiteUsage) => formatDateTime(row.updatedAt) },
  ];
  const accountColumns = [
    { header: "Account", cell: (row: AccountUsage) => <UserLink uid={row.uid} email={row.email} /> },
    { header: "Requests", cell: (row: AccountUsage) => formatCount(row.requests), className: "tabular-nums" },
  ];

  return (
    <>
      <PageHeader title="AI usage" description="Request count (includes failed requests). Provider cost: not tracked." />
      {!data ? (
        <LoadState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          <StatGrid>
            <StatTile label="Today" value={formatAgainstLimit(data.today.requests, data.today.limit)} hint={data.today.day} />
            <StatTile label="Remaining today" value={data.today.remaining === null ? "No limit" : formatCount(data.today.remaining)} />
            <StatTile label="This month" value={formatAgainstLimit(data.month.requests, data.month.limit)} hint={data.month.month} />
            <StatTile label="Remaining this month" value={data.month.remaining === null ? "No limit" : formatCount(data.month.remaining)} />
          </StatGrid>
          <p className="text-[13px] text-muted">
            Each account may make {data.accountLimits.daily} requests a day and {data.accountLimits.monthly} a month; each website{" "}
            {data.siteLimits.understand} understand and {data.siteLimits.generate} generate requests. No prompts or replies are stored.
          </p>

          <div className="grid min-w-0 gap-7 lg:grid-cols-2">
            <Panel title="Last 14 days">
              <DataTable
                label="Requests per day"
                rows={data.daily}
                rowKey={(row) => row.day}
                columns={[
                  { header: "Day", cell: (row) => row.day },
                  { header: "Requests", cell: (row) => formatCount(row.requests), className: "tabular-nums" },
                ]}
              />
            </Panel>
            <Panel title="Last 6 months">
              <DataTable
                label="Requests per month"
                rows={data.monthly}
                rowKey={(row) => row.month}
                columns={[
                  { header: "Month", cell: (row) => row.month },
                  { header: "Requests", cell: (row) => formatCount(row.requests), className: "tabular-nums" },
                ]}
              />
            </Panel>
            <Panel title="Top accounts today">
              <DataTable label="Top accounts today" rows={data.topAccountsToday} rowKey={(row) => row.uid} empty="No AI requests today." columns={accountColumns} />
            </Panel>
            <Panel title="Top accounts this month">
              <DataTable label="Top accounts this month" rows={data.topAccountsThisMonth} rowKey={(row) => row.uid} empty="No AI requests this month." columns={accountColumns} />
            </Panel>
          </div>

          <Panel title="Top websites">
            <DataTable label="Top websites" rows={data.topSites} rowKey={(row) => row.siteId} empty="No AI requests yet." columns={siteColumns(data.siteLimits)} />
          </Panel>
          <Panel title="Recently used, per website">
            <DataTable label="Per-website usage" rows={data.recentSites} rowKey={(row) => row.siteId} empty="No AI requests yet." columns={siteColumns(data.siteLimits)} />
          </Panel>
        </>
      )}
    </>
  );
}
