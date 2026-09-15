import type { ReactNode } from "react";
import { Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

/** A read-only table that scrolls sideways inside its own box on narrow screens. */
export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  loading = false,
  empty = "Nothing to show.",
}: {
  label: string;
  columns: Column<T>[];
  rows: T[] | null | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface" data-admin-table={label}>
      <table className="w-full border-collapse text-left text-[13px]">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="bg-ground">
            {columns.map((column) => (
              <th key={column.header} scope="col" className="whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && !rows?.length ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8">
                <div className="flex justify-center text-navy">
                  <Spinner size={22} />
                </div>
              </td>
            </tr>
          ) : !rows?.length ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-muted">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-line align-top">
                {columns.map((column) => (
                  <td key={column.header} className={cn("whitespace-nowrap px-3 py-2.5 text-ink", column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
