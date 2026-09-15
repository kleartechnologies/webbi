"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { DataTable } from "@/components/admin/DataTable";
import { FactList, LoadState, PageHeader, Panel, PublicLink, UserLink, reasonLabel } from "@/components/admin/Panel";
import { ModerationPill, PaymentStatusPill, SiteStatusPill, YesNo } from "@/components/admin/StatusPill";
import { Button } from "@/components/ui";
import { useAdminData } from "@/lib/admin/client";
import { EMPTY, formatBytes, formatCount, formatDateTime, formatSen } from "@/lib/admin/format";
import type { siteDetail, siteStorage } from "@/lib/admin/sites";

type SiteDetail = NonNullable<Awaited<ReturnType<typeof siteDetail>>>;
type SiteStorage = { storage: NonNullable<Awaited<ReturnType<typeof siteStorage>>> };

export function SiteDetailView() {
  const { siteId } = useParams<{ siteId: string }>();
  const base = siteId ? `/api/admin/sites/${encodeURIComponent(siteId)}` : null;
  const { data, error, loading, reload } = useAdminData<SiteDetail>(base);
  const [countImages, setCountImages] = useState(false);
  const storage = useAdminData<SiteStorage>(countImages && base ? `${base}?section=storage` : null);

  return (
    <>
      <Link href="/admin/sites" className="text-[13px] font-semibold text-navy hover:underline">
        ← All websites
      </Link>
      {!data ? (
        <LoadState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          <PageHeader title={data.site.businessName ?? "Untitled website"} description={data.site.category ?? undefined} />
          <FactList
            items={[
              ["Website ID", <code key="id" className="text-[13px]">{data.site.id}</code>],
              ["Owner", <UserLink key="owner" uid={data.site.ownerUid} email={data.site.ownerEmail} />],
              ["Status", <SiteStatusPill key="status" status={data.site.status} />],
              ["Paid", <YesNo key="paid" value={data.site.paid} />],
              ["Moderation", <ModerationPill key="mod" status={data.site.moderationStatus} />],
              ["Template", data.site.template ?? EMPTY],
              ["Link", data.site.slug ? `/w/${data.site.slug}` : EMPTY],
              ["Live website", <PublicLink key="preview" path={data.previewPath}>Open in a new tab</PublicLink>],
              ["Created", formatDateTime(data.site.createdAt)],
              ["Updated", formatDateTime(data.site.updatedAt)],
              ["Published", formatDateTime(data.site.publishedAt)],
              ["Paid at", formatDateTime(data.site.paidAt)],
            ]}
          />

          <Panel title="Payments">
            <DataTable
              label="Payments for this website"
              rows={data.payments}
              rowKey={(row) => row.id}
              empty="No payments."
              columns={[
                { header: "Created", cell: (row) => formatDateTime(row.createdAt) },
                { header: "Amount", cell: (row) => formatSen(row.paidAmountSen ?? row.amountSen), className: "tabular-nums" },
                { header: "Provider", cell: (row) => row.provider },
                { header: "Bill", cell: (row) => row.billId ?? EMPTY },
                { header: "Status", cell: (row) => <PaymentStatusPill payment={row} /> },
                { header: "Reason", cell: (row) => reasonLabel(row.attentionReason ?? row.failureReason) },
                { header: "Paid", cell: (row) => formatDateTime(row.paidAt) },
                { header: "Fulfilled", cell: (row) => formatDateTime(row.fulfilledAt) },
              ]}
            />
          </Panel>

          <Panel title="Moderation" note="Read only. Suspend or restore with npm run ops:moderate.">
            {data.moderation ? (
              <FactList
                items={[
                  ["Status", <ModerationPill key="s" status={data.moderation.status} />],
                  ["Reason", data.moderation.reason ?? EMPTY],
                  ["Suspended", formatDateTime(data.moderation.suspendedAt)],
                  ["Restored", formatDateTime(data.moderation.restoredAt)],
                ]}
              />
            ) : (
              <p className="text-[14px] text-muted">Never moderated.</p>
            )}
          </Panel>

          <Panel title="AI usage" note="Requests for this website, including failed ones.">
            <FactList
              items={[
                ["Understand", `${formatCount(data.ai.understandings)} of ${data.ai.limits.understand}`],
                ["Generate", `${formatCount(data.ai.generations)} of ${data.ai.limits.generate}`],
              ]}
            />
          </Panel>

          <Panel title="Images">
            {storage.data ? (
              <FactList
                items={[
                  ["Files", `${formatCount(storage.data.storage.files)}${storage.data.storage.capped ? "+" : ""}`],
                  ["Total size", formatBytes(storage.data.storage.bytes)],
                ]}
              />
            ) : storage.error ? (
              <LoadState loading={false} error={storage.error} onRetry={storage.reload} />
            ) : (
              <div>
                <Button variant="secondary" size="sm" loading={storage.loading} onClick={() => setCountImages(true)} data-admin-storage>
                  Count stored images
                </Button>
              </div>
            )}
          </Panel>

          <Panel title="Custom domain">
            <p className="text-[14px] text-muted">Custom domains arrive in V2. Nothing to manage yet.</p>
          </Panel>
        </>
      )}
    </>
  );
}
