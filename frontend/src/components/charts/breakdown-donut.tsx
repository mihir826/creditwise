"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCompactINR, formatINR, formatPercent } from "@/lib/format";
import { SERIES, TooltipCard } from "./common";

export function BreakdownDonut({
  principal,
  interest,
  fee,
  size = 180,
}: {
  principal: number;
  interest: number;
  fee: number;
  size?: number;
}) {
  const parts = [
    { name: "Principal", value: principal, color: SERIES.principal },
    { name: "Interest", value: interest, color: SERIES.interest },
    ...(fee > 0 ? [{ name: "Processing fee", value: fee, color: SERIES.fee }] : []),
  ];
  const total = parts.reduce((s, p) => s + p.value, 0);

  return (
    <div className="@container">
    <div className="flex flex-col items-center gap-6 @md:flex-row @md:gap-8">
      <div style={{ width: size, height: size }} className="relative shrink-0" role="img" aria-label="Principal, interest and fee share of total outflow">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={parts}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {parts.map((p) => (
                <Cell key={p.name} fill={p.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipCard
                    title={String(payload[0].name)}
                    rows={[{ label: "Amount", value: Number(payload[0].value), color: payload[0].payload.color }]}
                    footer={`${formatPercent((Number(payload[0].value) / total) * 100, 1)} of total outflow`}
                  />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] tracking-wide text-subtle uppercase">Total outflow</span>
          <span className="tabular text-lg font-medium text-fg">{formatCompactINR(total)}</span>
        </div>
      </div>
      <ul className="w-full space-y-3">
        {parts.map((p) => (
          <li key={p.name} className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
            <span className="flex items-center gap-2.5 text-sm text-muted">
              <span className="size-2.5 rounded-[3px]" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="text-right">
              <span className="tabular block text-sm font-medium text-fg">{formatINR(p.value)}</span>
              <span className="tabular text-xs text-subtle">{formatPercent(total ? (p.value / total) * 100 : 0, 1)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}
