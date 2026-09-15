"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/admin/DataTable";
import { LoadState, PageHeader, Panel, SiteLink } from "@/components/admin/Panel";
import { StatGrid, StatTile } from "@/components/admin/StatTile";
import { Button } from "@/components/ui";
import { adminRequest, useAdminData } from "@/lib/admin/client";
import { formatAgainstLimit, formatCount, formatDateTime, formatSen } from "@/lib/admin/format";
import type { OverviewSnapshot } from "@/lib/admin/metrics";
import { errorMessage } from "@/lib/api/client";

export function OverviewView() {
  const { data, error, loading, reload } = useAdminData<OverviewSnapshot>("/api/admin/overview");
  const [refreshed, setRefreshed] = useState<OverviewSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const snapshot = refreshed && (!data || refreshed.computedAt >= data.computedAt) ? refreshed : data;
  const coolingDown = snapshot ? now > 0 && now < Date.parse(snapshot.refreshAvailableAt) : false;

  async function refresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      setRefreshed(await adminRequest<OverviewSnapshot>("/api/admin/overview?refresh=1"));
      setNow(Date.now());
    } catch (e) {
      setRefreshError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Overview"
        description={snapshot ? `Figures from ${formatDateTime(snapshot.computedAt)}. Refreshed every 5 minutes.` : "Loading figures."}
        actions={
          snapshot ? (
            <Button variant="secondary" size="sm" loading={refreshing} disabled={coolingDown} onClick={refresh} data-admin-refresh>
              {coolingDown ? "Refreshed" : "Refresh now"}
            </Button>
          ) : null
        }
      />
      {refreshError ? <LoadState loading={false} error={refreshError} /> : null}
      {!snapshot ? <LoadState loading={loading} error={error} onRetry={reload} /> : <Figures snapshot={snapshot} />}
    </>
  );
}

function Figures({ snapshot }: { snapshot: OverviewSnapshot }) {
  const { users, websites, revenue, ai, moderation } = snapshot.data;
  return (
    <>
      <Panel title="Users" note={users.capped ? `Only the first ${formatCount(users.total)} accounts were counted.` : "From Firebase Auth. Days are Malaysia days."}>
        <StatGrid>
          <StatTile label="Total" value={formatCount(users.total)} />
          <StatTile label="New today" value={formatCount(users.newToday)} />
          <StatTile label="New, 7 days" value={formatCount(users.new7Days)} />
          <StatTile label="New, 30 days" value={formatCount(users.new30Days)} />
          <StatTile label="Verified email" value={formatCount(users.verified)} />
          <StatTile label="Google" value={formatCount(users.google)} />
          <StatTile label="Email and password" value={formatCount(users.emailPassword)} />
          <StatTile label="Disabled" value={formatCount(users.disabled)} />
        </StatGrid>
      </Panel>

      <Panel title="Websites">
        <StatGrid>
          <StatTile label="Total" value={formatCount(websites.total)} />
          <StatTile label="Drafts" value={formatCount(websites.drafts)} />
          <StatTile label="Live" value={formatCount(websites.live)} />
          <StatTile label="Created today" value={formatCount(websites.createdToday)} />
          <StatTile label="Published today" value={formatCount(websites.publishedToday)} />
        </StatGrid>
      </Panel>

      <Panel title="Revenue" note={revenue.note}>
        <StatGrid>
          <StatTile label="Paid orders" value={formatCount(revenue.paidOrders)} />
          <StatTile label="Collected today" value={formatSen(revenue.collectedTodaySen)} />
          <StatTile label="Collected, 7 days" value={formatSen(revenue.collected7DaysSen)} />
          <StatTile label="Collected, 30 days" value={formatSen(revenue.collected30DaysSen)} />
          <StatTile label="Collected, all time" value={formatSen(revenue.collectedAllTimeSen)} />
          <StatTile label="Pending bills" value={formatCount(revenue.pendingBills)} />
          <StatTile label="Pending over 24 hours" value={formatCount(revenue.pendingOver24h)} />
          <StatTile label="Paid, not live" value={formatCount(revenue.paidNotLive)} alert={revenue.paidNotLive > 0} />
          <StatTile label="Needs attention" value={formatCount(revenue.needsAttention)} alert={revenue.needsAttention > 0} />
          <StatTile label="Needs refund" value={formatCount(revenue.needsRefund)} alert={revenue.needsRefund > 0} />
        </StatGrid>
      </Panel>

      <Panel title="AI usage" note={ai.note}>
        <StatGrid>
          <StatTile label="Today" value={formatAgainstLimit(ai.today, ai.dailyLimit)} hint={ai.day} />
          <StatTile label="Remaining today" value={ai.dailyRemaining === null ? "No limit" : formatCount(ai.dailyRemaining)} />
          <StatTile label="This month" value={formatAgainstLimit(ai.thisMonth, ai.monthlyLimit)} hint={ai.month} />
          <StatTile label="Remaining this month" value={ai.monthlyRemaining === null ? "No limit" : formatCount(ai.monthlyRemaining)} />
        </StatGrid>
      </Panel>

      <Panel title="Moderation">
        <StatGrid>
          <StatTile label="Suspended" value={formatCount(moderation.suspended)} />
          <StatTile label="Active" value={formatCount(moderation.active)} />
        </StatGrid>
        <DataTable
          label="Latest suspensions"
          rows={moderation.latest}
          rowKey={(row) => row.siteId}
          empty="No website is suspended."
          columns={[
            { header: "Website", cell: (row) => <SiteLink id={row.siteId} name={row.siteId} /> },
            { header: "Suspended", cell: (row) => formatDateTime(row.suspendedAt) },
          ]}
        />
      </Panel>
    </>
  );
}
