"use client";

import { useState } from "react";
import { DataTable } from "@/components/admin/DataTable";
import { FactList, LoadState, PageHeader, Panel } from "@/components/admin/Panel";
import { StatusPill, YesNo, type PillTone } from "@/components/admin/StatusPill";
import { Button } from "@/components/ui";
import { adminRequest, useAdminData } from "@/lib/admin/client";
import { EMPTY, formatDateTime } from "@/lib/admin/format";
import type { ServiceState, ServiceStatus, SystemStatus } from "@/lib/admin/health";
import type { SystemCheck } from "@/lib/admin/schemas";
import { errorMessage } from "@/lib/api/client";

const STATES: Record<ServiceState, [PillTone, string]> = {
  ok: ["success", "Working"],
  error: ["danger", "Problem"],
  not_configured: ["warning", "Not configured"],
  not_checked: ["neutral", "Not checked"],
  not_monitored: ["neutral", "Not actively monitored"],
};

export function SystemView() {
  const { data, error, loading, reload } = useAdminData<SystemStatus>("/api/admin/system");
  const [checked, setChecked] = useState<Partial<Record<string, ServiceStatus>>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  async function check(service: SystemCheck) {
    setRunning(service);
    setCheckError(null);
    try {
      const result = await adminRequest<ServiceStatus>("/api/admin/system/check", { method: "POST", body: { service } });
      setChecked((current) => ({ ...current, [service]: result }));
    } catch (e) {
      setCheckError(errorMessage(e));
    } finally {
      setRunning(null);
    }
  }

  const services = data?.services.map((service) => checked[service.id] ?? service);

  return (
    <>
      <PageHeader
        title="System"
        description="Only what Webbi can check itself. OpenAI and Billplz are checked only when you ask."
        actions={
          <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
            Check again
          </Button>
        }
      />
      {checkError ? <LoadState loading={false} error={checkError} /> : null}
      {!data ? (
        <LoadState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          <Panel title="Services">
            <DataTable
              label="Services"
              rows={services}
              rowKey={(row) => row.id}
              columns={[
                { header: "Service", cell: (row) => <strong>{row.label}</strong> },
                {
                  header: "State",
                  cell: (row) => {
                    const [tone, text] = STATES[row.state];
                    return <StatusPill tone={tone}>{text}</StatusPill>;
                  },
                },
                { header: "Latency", cell: (row) => (row.latencyMs === null ? EMPTY : `${row.latencyMs} ms`), className: "tabular-nums" },
                { header: "Checked", cell: (row) => formatDateTime(row.checkedAt) },
                { header: "Detail", cell: (row) => row.detail, className: "whitespace-normal min-w-[200px]" },
                {
                  header: "Check",
                  cell: (row) =>
                    row.checkable ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={running === row.id}
                        disabled={running !== null}
                        onClick={() => check(row.id as SystemCheck)}
                        data-admin-check={row.id}
                      >
                        Run check
                      </Button>
                    ) : (
                      EMPTY
                    ),
                },
              ]}
            />
          </Panel>
          <Panel title="Configuration" note="Whether each setting is present. Values are never shown.">
            <FactList
              items={data.configuration.map((item) => [
                item.label,
                typeof item.value === "boolean" ? <YesNo key={item.key} value={item.value} yes="Set" no="Not set" /> : item.value,
              ])}
            />
          </Panel>
        </>
      )}
    </>
  );
}
