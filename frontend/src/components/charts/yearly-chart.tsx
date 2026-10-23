"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactINR } from "@/lib/format";
import type { YearRow } from "@/lib/types";
import { axisProps, gridProps, SERIES, TooltipCard } from "./common";

/** Principal vs interest repaid in each loan year (stacked bars). */
export function YearlyChart({ data, height = 260 }: { data: YearRow[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Principal and interest repaid per loan year">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 20, bottom: 0, left: 0 }} barCategoryGap={data.length > 20 ? 2 : "18%"}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="year"
            {...axisProps}
            interval={data.length > 20 ? 4 : data.length > 10 ? 1 : 0}
            tickFormatter={(y) => `Yr ${y}`}
          />
          <YAxis tickFormatter={formatCompactINR} width={58} {...axisProps} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const y = payload[0].payload as YearRow;
              return (
                <TooltipCard
                  title={`Year ${y.year}`}
                  rows={[
                    { label: "Principal", value: y.principal, color: SERIES.principal },
                    { label: "Interest", value: y.interest, color: SERIES.interest },
                    { label: "Balance at year end", value: y.closing_balance },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="principal" stackId="y" fill={SERIES.principal} stroke="var(--surface)" strokeWidth={1} isAnimationActive={false} />
          <Bar dataKey="interest" stackId="y" fill={SERIES.interest} stroke="var(--surface)" strokeWidth={1} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
