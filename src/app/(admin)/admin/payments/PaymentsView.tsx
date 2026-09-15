"use client";

import { useState } from "react";
import { DataTable } from "@/components/admin/DataTable";
import { Pager, useCursorPager } from "@/components/admin/Pager";
import { FilterBar, LoadState, PageHeader, SiteLink, UserLink, reasonLabel } from "@/components/admin/Panel";
import { PaymentStatusPill } from "@/components/admin/StatusPill";
import { useAdminData } from "@/lib/admin/client";
import { EMPTY, formatDateTime, formatSen } from "@/lib/admin/format";
import type { listPayments } from "@/lib/admin/payments";
import type { PaymentView } from "@/lib/admin/schemas";

type PaymentsPage = Awaited<ReturnType<typeof listPayments>>;

const VIEWS = [
  ["recent", "Recent"],
  ["paid", "Paid"],
  ["pending", "Pending"],
  ["failed", "Failed"],
  ["attention", "Needs attention"],
  ["refund", "Needs refund"],
] as const satisfies readonly (readonly [PaymentView, string])[];

export function PaymentsView() {
  const [view, setView] = useState<PaymentView>("recent");
  const pager = useCursorPager(view);
  const params = new URLSearchParams({ view, limit: "25" });
  if (pager.cursor) params.set("cursor", pager.cursor);
  const { data, error, loading, reload } = useAdminData<PaymentsPage>(`/api/admin/payments?${params}`);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Collected per Webbi's records. Refunds are handled outside Webbi and are not deducted."
      />
      <FilterBar label="Payment views" options={VIEWS} value={view} onChange={setView} />
      {error ? <LoadState loading={false} error={error} onRetry={reload} /> : null}
      <DataTable
        label="Payments"
        loading={loading}
        rows={data?.payments}
        rowKey={(row) => row.id}
        empty="No payments here."
        columns={[
          { header: "Created", cell: (row) => formatDateTime(row.createdAt) },
          { header: "Amount", cell: (row) => formatSen(row.paidAmountSen ?? row.amountSen), className: "tabular-nums" },
          { header: "Provider", cell: (row) => row.provider },
          { header: "Bill ID", cell: (row) => row.billId ?? EMPTY },
          { header: "Status", cell: (row) => <PaymentStatusPill payment={row} /> },
          { header: "Reason", cell: (row) => reasonLabel(row.attentionReason ?? row.failureReason) },
          { header: "Website", cell: (row) => <SiteLink id={row.siteId} name={row.slug ?? row.siteId} /> },
          { header: "Owner", cell: (row) => <UserLink uid={row.ownerUid} email={row.ownerEmail} /> },
          { header: "Paid", cell: (row) => formatDateTime(row.paidAt) },
          { header: "Fulfilled", cell: (row) => formatDateTime(row.fulfilledAt) },
        ]}
      />
      <Pager page={pager.page} nextCursor={data?.nextCursor} loading={loading} onPrev={pager.prev} onNext={pager.next} />
    </>
  );
}
