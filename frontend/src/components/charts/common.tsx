"use client";

import type { ReactNode } from "react";
import { formatINR } from "@/lib/format";

export const SERIES = {
  principal: "var(--chart-1)",
  interest: "var(--chart-2)",
  fee: "var(--chart-3)",
  line: "var(--chart-line)",
} as const;

/** Scenario identity colours (fixed order, never cycled). */
export const SCENARIO_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"] as const;

export const axisProps = {
  stroke: "var(--subtle)",
  tick: { fill: "var(--subtle)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = { stroke: "var(--grid)", strokeDasharray: "0", vertical: false } as const;

export interface TooltipRow {
  label: string;
  value: number;
  color?: string;
}

export function TooltipCard({ title, rows, footer }: { title: ReactNode; rows: TooltipRow[]; footer?: ReactNode }) {
  return (
    <div className="min-w-[200px] rounded-xl border border-border-strong bg-[#1c1d21]/95 px-3.5 py-3 text-[12px] shadow-xl shadow-black/40 backdrop-blur">
      <p className="mb-2 font-medium text-fg">{title}</p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-muted">
              {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="tabular font-medium text-fg">{formatINR(r.value)}</span>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-2 border-t border-border pt-2 text-muted">{footer}</div>}
    </div>
  );
}

export function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-2 text-[12px] text-muted">
      {dashed ? (
        <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: color }} />
      ) : (
        <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
      )}
      {label}
    </span>
  );
}

export function monthLabel(month: number) {
  const year = Math.ceil(month / 12);
  return `Month ${month} · Year ${year}`;
}
