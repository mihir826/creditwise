"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { formatINR } from "@/lib/format";
import type { ScheduleRow, YearRow } from "@/lib/types";

const PAGE = 12;

export function AmortizationTable({ schedule, yearly }: { schedule: ScheduleRow[]; yearly: YearRow[] }) {
  const [view, setView] = useState<"monthly" | "yearly">("monthly");
  const [page, setPage] = useState(0);
  const pages = Math.ceil(schedule.length / PAGE);
  const current = Math.min(page, pages - 1);
  const rows = schedule.slice(current * PAGE, current * PAGE + PAGE);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Schedule view"
          value={view}
          onChange={setView}
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
          ]}
        />
        {view === "monthly" && pages > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Previous year" disabled={current === 0} onClick={() => setPage(current - 1)}>
              <ChevronLeft />
            </Button>
            <label className="sr-only" htmlFor="schedule-page">
              Year
            </label>
            <select
              id="schedule-page"
              value={current}
              onChange={(e) => setPage(Number(e.target.value))}
              className="tabular h-9 rounded-full border border-border bg-bg px-3 text-[13px] text-fg"
            >
              {Array.from({ length: pages }, (_, i) => (
                <option key={i} value={i}>
                  Year {i + 1} · months {i * PAGE + 1}–{Math.min((i + 1) * PAGE, schedule.length)}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="icon" aria-label="Next year" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
        <table className="tabular w-full min-w-[640px] text-right text-[13px]">
          <caption className="sr-only">
            {view === "monthly" ? `Monthly repayment schedule, year ${current + 1}` : "Yearly repayment summary"}
          </caption>
          <thead className="bg-surface-2 text-[11px] tracking-wide text-subtle uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-medium">
                {view === "monthly" ? "Month" : "Year"}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">Payment</th>
              <th scope="col" className="px-4 py-3 font-medium">Principal</th>
              <th scope="col" className="px-4 py-3 font-medium">Interest</th>
              <th scope="col" className="px-4 py-3 font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {view === "monthly"
              ? rows.map((r) => (
                  <tr key={r.month} className="border-t border-border hover:bg-surface-2/60">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal text-muted">
                      {r.month}
                    </th>
                    <td className="px-4 py-2.5 text-fg">{formatINR(r.payment)}</td>
                    <td className="px-4 py-2.5 text-fg">{formatINR(r.principal)}</td>
                    <td className="px-4 py-2.5 text-fg">{formatINR(r.interest)}</td>
                    <td className="px-4 py-2.5 text-muted">{formatINR(r.closing_balance)}</td>
                  </tr>
                ))
              : yearly.map((y) => (
                  <tr key={y.year} className="border-t border-border hover:bg-surface-2/60">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal text-muted">
                      {y.year}
                    </th>
                    <td className="px-4 py-2.5 text-fg">{formatINR(y.payment)}</td>
                    <td className="px-4 py-2.5 text-fg">{formatINR(y.principal)}</td>
                    <td className="px-4 py-2.5 text-fg">{formatINR(y.interest)}</td>
                    <td className="px-4 py-2.5 text-muted">{formatINR(y.closing_balance)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
