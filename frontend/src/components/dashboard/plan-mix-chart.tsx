"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function PlanMixChart({
  data,
  total,
}: {
  data: { name: string; value: number; subscriptions: number }[];
  total: number;
}) {
  if (!data.length) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[13px] text-muted-foreground">
        No active subscriptions yet
      </div>
    );
  }
  return (
    <div>
      <div className="relative h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={56} outerRadius={80} paddingAngle={2} strokeWidth={0}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--card)",
                fontSize: 12,
              }}
              formatter={(value) => [formatCurrency(Number(value)), "MRR"]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">MRR</span>
          <span className="text-base font-semibold">{formatCurrency(total)}</span>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center gap-2 text-[12px]">
            <span className="size-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
            <span className="flex-1 truncate text-muted-foreground">{item.name}</span>
            <span className="tabular-nums font-medium">{formatCurrency(item.value)}</span>
            <span className="w-8 text-right text-[11px] text-muted-foreground">{item.subscriptions}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
