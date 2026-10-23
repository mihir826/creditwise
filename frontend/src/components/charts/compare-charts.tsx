"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactINR } from "@/lib/format";
import type { ScenarioResult } from "@/lib/types";
import { axisProps, gridProps, SCENARIO_COLORS, TooltipCard } from "./common";

/** Cost components grouped by metric; colour = scenario identity. */
export function CostComparisonChart({ scenarios, height = 280 }: { scenarios: ScenarioResult[]; height?: number }) {
  const metrics = [
    { key: "Total interest", get: (s: ScenarioResult) => s.summary.total_interest },
    { key: "Upfront fees", get: (s: ScenarioResult) => s.summary.fee_amount },
    { key: "Borrowing cost", get: (s: ScenarioResult) => s.summary.total_borrowing_cost },
  ];
  const data = metrics.map((m) => ({
    metric: m.key,
    ...Object.fromEntries(scenarios.map((s, i) => [`s${i}`, m.get(s)])),
  }));
  return (
    <div style={{ height }} role="img" aria-label="Interest, fees and borrowing cost by scenario">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 20, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="metric" {...axisProps} />
          <YAxis tickFormatter={formatCompactINR} width={58} {...axisProps} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={String(label)}
                  rows={scenarios.map((s, i) => ({ label: s.label, value: Number(payload[0].payload[`s${i}`]), color: SCENARIO_COLORS[i] }))}
                />
              ) : null
            }
          />
          {scenarios.map((s, i) => (
            <Bar key={i} dataKey={`s${i}`} name={s.label} fill={SCENARIO_COLORS[i]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Outstanding balance at each year end, one line per scenario. */
export function BalanceComparisonChart({ scenarios, height = 280 }: { scenarios: ScenarioResult[]; height?: number }) {
  const years = Math.max(...scenarios.map((s) => s.yearly.length));
  const data = Array.from({ length: years + 1 }, (_, y) => ({
    year: y,
    ...Object.fromEntries(
      scenarios.map((s, i) => [`s${i}`, y === 0 ? s.summary.principal : y <= s.yearly.length ? s.yearly[y - 1].closing_balance : null]),
    ),
  }));
  return (
    <div style={{ height }} role="img" aria-label="Outstanding balance by year for each scenario">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="year" {...axisProps} tickFormatter={(y) => (y === 0 ? "Start" : `Yr ${y}`)} interval={years > 15 ? 4 : years > 8 ? 1 : 0} />
          <YAxis tickFormatter={formatCompactINR} width={58} {...axisProps} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={label === 0 ? "Start" : `End of year ${label}`}
                  rows={scenarios
                    .map((s, i) => ({ label: s.label, value: payload[0].payload[`s${i}`] as number | null, color: SCENARIO_COLORS[i] }))
                    .filter((r): r is { label: string; value: number; color: (typeof SCENARIO_COLORS)[number] } => r.value !== null)}
                />
              ) : null
            }
          />
          {scenarios.map((s, i) => (
            <Line
              key={i}
              type="monotone"
              dataKey={`s${i}`}
              name={s.label}
              stroke={SCENARIO_COLORS[i]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
