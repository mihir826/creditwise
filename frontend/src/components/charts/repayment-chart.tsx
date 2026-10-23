"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactINR } from "@/lib/format";
import { axisProps, gridProps, monthLabel, SERIES, TooltipCard } from "./common";

export interface MonthPoint {
  month: number;
  balance: number;
  principal?: number;
  interest?: number;
}

function yearTicks(maxMonth: number): number[] {
  const years = Math.ceil(maxMonth / 12);
  const step = years <= 6 ? 1 : years <= 12 ? 2 : years <= 25 ? 5 : 10;
  const ticks: number[] = [];
  if (maxMonth <= 24) {
    const mStep = maxMonth <= 12 ? 1 : 3;
    for (let m = mStep; m <= maxMonth; m += mStep) ticks.push(m);
    return ticks;
  }
  for (let y = step; y * 12 <= maxMonth; y += step) ticks.push(y * 12);
  return ticks;
}

function tickLabel(month: number, maxMonth: number) {
  return maxMonth <= 24 ? `M${month}` : `Yr ${month / 12}`;
}

/** Outstanding balance over time — a single lavender series. */
export function BalanceChart({ data, height = 280 }: { data: MonthPoint[]; height?: number }) {
  const max = data.at(-1)?.month ?? 0;
  return (
    <div style={{ height }} role="img" aria-label="Outstanding balance by month">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c5acff" stopOpacity={0.38} />
              <stop offset="100%" stopColor="#c5acff" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" type="number" domain={[1, Math.max(max, 1)]} ticks={yearTicks(max)} tickFormatter={(m) => tickLabel(m, max)} {...axisProps} />
          <YAxis tickFormatter={formatCompactINR} width={58} {...axisProps} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={monthLabel(payload[0].payload.month)}
                  rows={[{ label: "Balance after payment", value: payload[0].payload.balance, color: SERIES.line }]}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={SERIES.line}
            strokeWidth={2}
            fill="url(#balanceFill)"
            activeDot={{ r: 5, fill: "#c5acff", stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Monthly payment split into principal and interest (stacked). */
export function PaymentSplitChart({ data, height = 280 }: { data: MonthPoint[]; height?: number }) {
  const max = data.at(-1)?.month ?? 0;
  return (
    <div style={{ height }} role="img" aria-label="Monthly principal and interest">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" type="number" domain={[1, Math.max(max, 1)]} ticks={yearTicks(max)} tickFormatter={(m) => tickLabel(m, max)} {...axisProps} />
          <YAxis tickFormatter={formatCompactINR} width={58} {...axisProps} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as MonthPoint;
              return (
                <TooltipCard
                  title={monthLabel(p.month)}
                  rows={[
                    { label: "Principal", value: p.principal ?? 0, color: SERIES.principal },
                    { label: "Interest", value: p.interest ?? 0, color: SERIES.interest },
                  ]}
                />
              );
            }}
          />
          <Area type="stepAfter" dataKey="principal" stackId="1" stroke={SERIES.principal} strokeWidth={1.5} fill={SERIES.principal} fillOpacity={0.55} isAnimationActive={false} />
          <Area type="stepAfter" dataKey="interest" stackId="1" stroke={SERIES.interest} strokeWidth={1.5} fill={SERIES.interest} fillOpacity={0.55} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
