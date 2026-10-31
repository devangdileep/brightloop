"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactCurrency, formatCurrency } from "@/lib/utils";

export function RevenueChart({
  data,
  height = 280,
}: {
  data: { label: string; collected: number; billed: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="collected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.22} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="billed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.16} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.7} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(value) => formatCompactCurrency(Number(value))}
            width={64}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            }}
            labelStyle={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}
            formatter={(value, name) => [formatCurrency(Number(value)), name === "collected" ? "Collected" : "Billed"]}
          />
          <Area
            type="monotone"
            dataKey="billed"
            stroke="var(--chart-2)"
            strokeWidth={1.5}
            fill="url(#billed)"
            name="billed"
          />
          <Area
            type="monotone"
            dataKey="collected"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#collected)"
            name="collected"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend() {
  return (
    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-[var(--chart-1)]" /> Collected
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-[var(--chart-2)]" /> Billed
      </span>
    </div>
  );
}
