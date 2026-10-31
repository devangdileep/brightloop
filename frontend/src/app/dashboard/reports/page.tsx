import Link from "next/link";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";
import { requireStaff } from "@/lib/auth";
import { formatCurrency, monthKey, monthlyValue } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { RevenueChart, ChartLegend } from "@/components/dashboard/revenue-chart";
import { GrowthChart } from "@/components/dashboard/growth-chart";
import { PlanMixChart } from "@/components/dashboard/plan-mix-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";

type SubRow = {
  id: string;
  status: string;
  quantity: number;
  started_at: string;
  canceled_at: string | null;
  plan: { name: string; price: number; interval: string; interval_count: number } | null;
};
type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  issue_date: string;
  due_date: string;
  total: number;
  amount_paid: number;
  tax_total: number;
  discount_total: number;
  customer: { name: string } | null;
};
type PaymentRow = {
  id: string;
  amount: number;
  paid_at: string;
  method: string;
  customer: { name: string } | null;
};

export default async function ReportsPage() {
  const { supabase } = await requireStaff();
  const now = new Date();
  const yearAgo = startOfMonth(subMonths(now, 11));

  const [subsRes, invoicesRes, paymentsRes, customersRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id,status,quantity,started_at,canceled_at,plan:plans(name,price,interval,interval_count)"),
    supabase
      .from("invoices")
      .select("id,number,status,issue_date,due_date,total,amount_paid,tax_total,discount_total,customer:customers(name)")
      .gte("issue_date", format(yearAgo, "yyyy-MM-dd")),
    supabase
      .from("payments")
      .select("id,amount,paid_at,method,customer:customers(name)")
      .gte("paid_at", yearAgo.toISOString()),
    supabase.from("customers").select("id,created_at").gte("created_at", yearAgo.toISOString()),
  ]);

  const subscriptions = (subsRes.data ?? []) as unknown as SubRow[];
  const invoices = (invoicesRes.data ?? []) as unknown as InvoiceRow[];
  const payments = (paymentsRes.data ?? []) as unknown as PaymentRow[];
  const customers = customersRes.data ?? [];

  const active = subscriptions.filter((sub) => sub.status === "active" || sub.status === "trialing");
  const mrr = active.reduce(
    (sum, sub) =>
      sum + (sub.plan ? monthlyValue(Number(sub.plan.price) * sub.quantity, sub.plan.interval, sub.plan.interval_count) : 0),
    0
  );
  const arpu = active.length ? mrr / active.length : 0;
  const collected = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const taxCollected = invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + Number(invoice.tax_total), 0);
  const discountGiven = invoices.reduce((sum, invoice) => sum + Number(invoice.discount_total), 0);
  const openInvoices = invoices.filter((invoice) => invoice.status === "open");
  const outstanding = openInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.total) - Number(invoice.amount_paid),
    0
  );
  const canceledRecent = subscriptions.filter(
    (sub) => sub.status === "canceled" && sub.canceled_at && new Date(sub.canceled_at) >= startOfMonth(now)
  ).length;
  const churn = active.length + canceledRecent > 0 ? (canceledRecent / (active.length + canceledRecent)) * 100 : 0;

  const monthly = Array.from({ length: 12 }).map((_, index) => {
    const date = subMonths(now, 11 - index);
    const key = monthKey(date);
    const monthInvoices = invoices.filter((invoice) => monthKey(new Date(invoice.issue_date)) === key);
    const monthPayments = payments.filter((payment) => monthKey(new Date(payment.paid_at)) === key);
    return {
      key,
      label: format(date, "MMM"),
      fullLabel: format(date, "MMMM yyyy"),
      billed: monthInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0),
      collected: monthPayments.reduce((sum, payment) => sum + Number(payment.amount), 0),
      tax: monthInvoices.reduce((sum, invoice) => sum + Number(invoice.tax_total), 0),
      discounts: monthInvoices.reduce((sum, invoice) => sum + Number(invoice.discount_total), 0),
      invoices: monthInvoices.length,
    };
  });

  const revenueData = monthly.map((month) => ({ label: month.label, collected: month.collected, billed: month.billed }));

  const growthData = Array.from({ length: 6 }).map((_, index) => {
    const date = subMonths(now, 5 - index);
    const key = monthKey(date);
    return {
      label: format(date, "MMM"),
      subscriptions: customers.filter((customer) => monthKey(new Date(customer.created_at)) === key).length,
    };
  });

  const planMap = new Map<string, { value: number; subscriptions: number }>();
  for (const sub of active) {
    if (!sub.plan) continue;
    const value = monthlyValue(Number(sub.plan.price) * sub.quantity, sub.plan.interval, sub.plan.interval_count);
    const entry = planMap.get(sub.plan.name) ?? { value: 0, subscriptions: 0 };
    entry.value += value;
    entry.subscriptions += 1;
    planMap.set(sub.plan.name, entry);
  }
  const planMix = Array.from(planMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.value - a.value);

  const topCustomersMap = new Map<string, number>();
  for (const payment of payments) {
    const name = payment.customer?.name ?? "Unknown";
    topCustomersMap.set(name, (topCustomersMap.get(name) ?? 0) + Number(payment.amount));
  }
  const topCustomers = Array.from(topCustomersMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const paymentMix = new Map<string, number>();
  for (const payment of payments) {
    paymentMix.set(payment.method, (paymentMix.get(payment.method) ?? 0) + Number(payment.amount));
  }
  const paymentMixRows = Array.from(paymentMix.entries()).sort((a, b) => b[1] - a[1]);

  const nowDate = new Date();
  const aging = [
    {
      label: "Current",
      amount: openInvoices
        .filter((invoice) => new Date(`${invoice.due_date}T23:59:59`) >= nowDate)
        .reduce((sum, invoice) => sum + Number(invoice.total) - Number(invoice.amount_paid), 0),
    },
    {
      label: "1–30 days",
      amount: openInvoices
        .filter((invoice) => {
          const due = new Date(`${invoice.due_date}T23:59:59`);
          return due < nowDate && nowDate.getTime() - due.getTime() <= 30 * 86400000;
        })
        .reduce((sum, invoice) => sum + Number(invoice.total) - Number(invoice.amount_paid), 0),
    },
    {
      label: "31–60 days",
      amount: openInvoices
        .filter((invoice) => {
          const days = (nowDate.getTime() - new Date(`${invoice.due_date}T23:59:59`).getTime()) / 86400000;
          return days > 30 && days <= 60;
        })
        .reduce((sum, invoice) => sum + Number(invoice.total) - Number(invoice.amount_paid), 0),
    },
    {
      label: "60+ days",
      amount: openInvoices
        .filter((invoice) => (nowDate.getTime() - new Date(`${invoice.due_date}T23:59:59`).getTime()) / 86400000 > 60)
        .reduce((sum, invoice) => sum + Number(invoice.total) - Number(invoice.amount_paid), 0),
    },
  ];
  const maxAging = Math.max(...aging.map((bucket) => bucket.amount), 1);

  const statusCounts = new Map<string, { count: number; total: number }>();
  for (const invoice of invoices) {
    const entry = statusCounts.get(invoice.status) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += Number(invoice.total);
    statusCounts.set(invoice.status, entry);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={`Rolling twelve months · ${format(yearAgo, "MMM yyyy")} to ${format(now, "MMM yyyy")}`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/api/export/invoices" prefetch={false}>
                <Download className="size-3.5" /> Invoices CSV
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/api/export/payments" prefetch={false}>
                <Download className="size-3.5" /> Payments CSV
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="MRR" value={formatCurrency(mrr)} hint={`ARR ${formatCurrency(mrr * 12)}`} trend="up" icon={<TrendingUp className="size-4" />} />
        <StatCard label="ARPU" value={formatCurrency(arpu)} hint="per active subscription" />
        <StatCard label="Churn this month" value={`${churn.toFixed(1)}%`} hint={`${canceledRecent} cancellations`} trend={churn > 5 ? "down" : "neutral"} icon={<TrendingDown className="size-4" />} />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} hint={`${openInvoices.length} open invoices`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Revenue trend</CardTitle>
              <p className="text-[12px] text-muted-foreground">Twelve months of billed and collected revenue</p>
            </div>
            <ChartLegend />
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueData} height={300} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>MRR by plan</CardTitle>
            <p className="text-[12px] text-muted-foreground">Normalized monthly value of active subscriptions</p>
          </CardHeader>
          <CardContent>
            <PlanMixChart data={planMix} total={mrr} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Collected (12m)" value={formatCurrency(collected)} hint={`${payments.length} payments`} />
        <StatCard label="Tax collected" value={formatCurrency(taxCollected)} hint="on paid invoices" />
        <StatCard label="Discounts given" value={formatCurrency(discountGiven)} hint="on issued invoices" />
        <StatCard label="Invoices issued" value={String(invoices.length)} hint={`${invoices.filter((invoice) => invoice.status === "paid").length} paid`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Customer growth</CardTitle>
            <p className="text-[12px] text-muted-foreground">New customers per month</p>
          </CardHeader>
          <CardContent>
            <GrowthChart data={growthData} metricLabel="New customers" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Receivables aging</CardTitle>
            <p className="text-[12px] text-muted-foreground">Open balances by days past due</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {aging.map((bucket) => (
              <div key={bucket.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground">{bucket.label}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(bucket.amount)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${bucket.label === "Current" ? "bg-primary/60" : "bg-amber-500/70"}`}
                    style={{ width: `${Math.max((bucket.amount / maxAging) * 100, bucket.amount > 0 ? 3 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="border-t pt-3 text-[12px] text-muted-foreground">
              <div className="flex justify-between">
                <span>Total outstanding</span>
                <span className="font-medium text-foreground">{formatCurrency(outstanding)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Invoice status</CardTitle>
            <p className="text-[12px] text-muted-foreground">Last twelve months</p>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {Array.from(statusCounts.entries()).map(([status, data]) => (
              <div key={status} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <StatusBadge value={status} />
                <div className="text-right">
                  <p className="text-[12px] font-medium tabular-nums">{formatCurrency(data.total)}</p>
                  <p className="text-[10px] text-muted-foreground">{data.count} invoices</p>
                </div>
              </div>
            ))}
            {statusCounts.size === 0 ? <p className="py-6 text-center text-[12px] text-muted-foreground">No invoices in this period.</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly breakdown</CardTitle>
            <p className="text-[12px] text-muted-foreground">Billed, collected, tax and discounts by invoice issue month</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y bg-muted/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Month</th>
                    <th className="px-5 py-2.5 text-right font-medium">Invoices</th>
                    <th className="px-5 py-2.5 text-right font-medium">Billed</th>
                    <th className="px-5 py-2.5 text-right font-medium">Collected</th>
                    <th className="px-5 py-2.5 text-right font-medium">Tax</th>
                    <th className="px-5 py-2.5 text-right font-medium">Discounts</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((month) => (
                    <tr key={month.key} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-5 py-2.5 text-[12px] font-medium">{month.fullLabel}</td>
                      <td className="px-5 py-2.5 text-right text-[12px] tabular-nums">{month.invoices}</td>
                      <td className="px-5 py-2.5 text-right text-[12px] tabular-nums">{formatCurrency(month.billed)}</td>
                      <td className="px-5 py-2.5 text-right text-[12px] tabular-nums">{formatCurrency(month.collected)}</td>
                      <td className="px-5 py-2.5 text-right text-[12px] tabular-nums text-muted-foreground">{formatCurrency(month.tax)}</td>
                      <td className="px-5 py-2.5 text-right text-[12px] tabular-nums text-muted-foreground">{formatCurrency(month.discounts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top customers</CardTitle>
              <p className="text-[12px] text-muted-foreground">By collected revenue, last 12 months</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {topCustomers.map(([name, amount], index) => (
                <div key={name} className="flex items-center gap-2 text-[12px]">
                  <span className="w-4 text-[10px] text-muted-foreground">{index + 1}</span>
                  <span className="flex-1 truncate">{name}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(amount)}</span>
                </div>
              ))}
              {topCustomers.length === 0 ? <p className="py-6 text-center text-[12px] text-muted-foreground">No payments yet.</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payment mix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {paymentMixRows.map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between text-[12px]">
                  <StatusBadge value={method} />
                  <span className="font-medium tabular-nums">{formatCurrency(amount)}</span>
                </div>
              ))}
              {paymentMixRows.length === 0 ? <p className="py-6 text-center text-[12px] text-muted-foreground">No payments yet.</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
