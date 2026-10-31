import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  change,
  trend = "up",
  hint,
  icon,
}: {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground/60">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
        {change ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              trend === "up" ? "text-emerald-600 dark:text-emerald-400" : trend === "down" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
            )}
          >
            {trend === "up" ? <ArrowUpRight className="size-3" /> : trend === "down" ? <ArrowDownRight className="size-3" /> : null}
            {change}
          </span>
        ) : null}
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
    </Card>
  );
}
