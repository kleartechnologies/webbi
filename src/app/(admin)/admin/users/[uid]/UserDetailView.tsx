"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DataTable } from "@/components/admin/DataTable";
import { FactList, LoadState, PageHeader, Panel, SiteLink, reasonLabel } from "@/components/admin/Panel";
import { ModerationPill, PaymentStatusPill, SiteStatusPill, YesNo } from "@/components/admin/StatusPill";
import { useAdminData } from "@/lib/admin/client";
import { EMPTY, formatAgainstLimit, formatDateTime, formatSen, providerLabel } from "@/lib/admin/format";
import type { userDetail } from "@/lib/admin/users";

type UserDetail = NonNullable<Awaited<ReturnType<typeof userDetail>>>;

export function UserDetailView() {
  const { uid } = useParams<{ uid: string }>();
  const { data, error, loading, reload } = useAdminData<UserDetail>(uid ? `/api/admin/users/${encodeURIComponent(uid)}` : null);

  return (
    <>
      <Link href="/admin/users" className="text-[13px] font-semibold text-navy hover:underline">
        ← All users
      </Link>
      {!data ? (
        <LoadState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          <PageHeader title={data.account.name ?? data.account.email ?? "Account"} description={data.account.email ?? undefined} />
          <FactList
            items={[
              ["UID", <code key="uid" className="text-[13px]">{data.account.uid}</code>],
              ["Email", data.account.email ?? EMPTY],
              ["Sign-in", data.account.providers.map(providerLabel).join(", ") || EMPTY],
              ["Verified email", <YesNo key="v" value={data.account.emailVerified} />],
              ["Disabled", <YesNo key="d" value={data.account.disabled} yesTone="danger" />],
              ["Created", formatDateTime(data.account.createdAt)],
              ["Last sign-in", formatDateTime(data.account.lastLoginAt)],
              ["Open draft", data.openDraftSiteId ? <SiteLink key="draft" id={data.openDraftSiteId} name={data.openDraftSiteId} /> : "None"],
            ]}
          />

          <Panel title="Usage" note="AI counts include failed requests.">
            <FactList
              items={[
                [`AI today (${data.ai.day})`, formatAgainstLimit(data.ai.today, data.ai.dailyLimit)],
                [`AI this month (${data.ai.month})`, formatAgainstLimit(data.ai.thisMonth, data.ai.monthlyLimit)],
                ["Photo uploads today", formatAgainstLimit(data.uploads.today, data.uploads.dailyLimit)],
              ]}
            />
          </Panel>

          <Panel title="Websites">
            <DataTable
              label="Websites"
              rows={data.websites}
              rowKey={(row) => row.id}
              empty="No websites."
              columns={[
                { header: "Business", cell: (row) => <SiteLink id={row.id} name={row.businessName} /> },
                { header: "Status", cell: (row) => <SiteStatusPill status={row.status} /> },
                { header: "Paid", cell: (row) => <YesNo value={row.paid} /> },
                { header: "Moderation", cell: (row) => <ModerationPill status={row.moderationStatus} /> },
                { header: "Link", cell: (row) => (row.slug ? `/w/${row.slug}` : EMPTY) },
                { header: "Updated", cell: (row) => formatDateTime(row.updatedAt) },
              ]}
            />
          </Panel>

          <Panel title="Payments">
            <DataTable
              label="Payments"
              rows={data.payments}
              rowKey={(row) => row.id}
              empty="No payments."
              columns={[
                { header: "Created", cell: (row) => formatDateTime(row.createdAt) },
                { header: "Amount", cell: (row) => formatSen(row.paidAmountSen ?? row.amountSen), className: "tabular-nums" },
                { header: "Status", cell: (row) => <PaymentStatusPill payment={row} /> },
                { header: "Reason", cell: (row) => reasonLabel(row.attentionReason ?? row.failureReason) },
                { header: "Bill", cell: (row) => row.billId ?? EMPTY },
                { header: "Website", cell: (row) => <SiteLink id={row.siteId} name={row.slug ?? row.siteId} /> },
                { header: "Paid", cell: (row) => formatDateTime(row.paidAt) },
              ]}
            />
          </Panel>
        </>
      )}
    </>
  );
}
