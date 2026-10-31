import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  FileText,
  Plus,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";
import { requireStaff } from "@/lib/auth";
import { formatCurrency, formatDate, monthKey, monthlyValue, fromNow } from "@/lib/utils";
import { BillingRunButton } from "@/components/billing-run-button";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { RevenueChart, ChartLegend } from "@/components/dashboard/revenue-chart";
import { GrowthChart } from "@/components/dashboard/growth-chart";
import { PlanMixChart } from "@/components/dashboard/plan-mix-chart";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PlanJoin = { name: string; price: number; interval: string; interval_count: number } | null;
type CustomerJoin = { name: string; email: string } | null;

export default async function OverviewPage() {
  const { supabase, profile } = await requireStaff();

  const now = new Date();
  const twelveMonthsAgo = startOfMonth(subMonths(now, 11));

  const [subscriptionsRes, invoicesRes, paymentsRes, customersRes, quotationsRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, status, quantity, customer_id, started_at, current_period_end, plan:plans(name,price,interval,interval_count), customer:customers(name,email)")
      .order("current_period_end", { ascending: true }),
    supabase
      .from("invoices")
      .select("id, number, status, total, amount_paid, issue_date, due_date, customer:customers(name)")
      .order("issue_date", { ascending: false })
      .limit(300),
    supabase.from("payments").select("id, amount, paid_at, customer_id, customer:customers(name)").gte("paid_at", twelveMonthsAgo.toISOString()),
    supabase.from("customers").select("id, created_at"),
    supabase.from("quotations").select("id, status, total"),
  ]);

  const subscriptions = (subscriptionsRes.data ?? []) as unknown as Array<{
    id: string;
    status: string;
    quantity: number;
    customer_id: string;
    started_at: string;
    current_period_end: string;
    plan: PlanJoin;
    customer: CustomerJoin;
  }>;
  const invoices = (invoicesRes.data ?? []) as unknown as Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    amount_paid: number;
    issue_date: string;
    due_date: string;
    customer: CustomerJoin;
  }>;
  const payments = (paymentsRes.data ?? []) as unknown as Array<{
    id: string;
    amount: number;
    paid_at: string;
    customer_id: string;
    customer: CustomerJoin;
  }>;
  const customers = customersRes.data ?? [];
  const quotations = quotationsRes.data ?? [];

  const activeSubs = subscriptions.filter((sub) => sub.status === "active" || sub.status === "trialing");
  const mrr = activeSubs.reduce((sum, sub) => {
    if (!sub.plan) return sum;
    return sum + monthlyValue(Number(sub.plan.price) * sub.quantity, sub.plan.interval, sub.plan.interval_count);
  }, 0);

  const monthStart = startOfMonth(now);
  const lastMonthStart = subMonths(monthStart, 1);
  const collectedThisMonth = payments
    .filter((payment) => new Date(payment.paid_at) >= monthStart)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const collectedLastMonth = payments
    .filter((payment) => new Date(payment.paid_at) >= lastMonthStart && new Date(payment.paid_at) < monthStart)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const collectionChange = collectedLastMonth > 0
    ? ((collectedThisMonth - collectedLastMonth) / collectedLastMonth) * 100
    : collectedThisMonth > 0
      ? 100
      : 0;

  const openInvoices = invoices.filter((invoice) => invoice.status === "open");
  const outstanding = openInvoices.reduce(
    (sum, invoice) => sum + (Number(invoice.total) - Number(invoice.amount_paid)),
    0
  );
  const overdue = openInvoices.filter((invoice) => new Date(`${invoice.due_date}T23:59:59`) < now).length;
  const newSubsThisMonth = subscriptions.filter((sub) => new Date(sub.started_at) >= monthStart).length;

  const revenueData = Array.from({ length: 6 }).map((_, index) => {
    const date = subMonths(now, 5 - index);
    const key = monthKey(date);
    const collected = payments
      .filter((payment) => monthKey(new Date(payment.paid_at)) === key)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const billed = invoices
      .filter((invoice) => monthKey(new Date(invoice.issue_date)) === key && invoice.status !== "void" && invoice.status !== "draft")
      .reduce((sum, invoice) => sum + Number(invoice.total), 0);
    return { label: format(date, "MMM"), collected, billed };
  });

  const growthData = Array.from({ length: 6 }).map((_, index) => {
    const date = subMonths(now, 5 - index);
    const key = monthKey(date);
    return {
      label: format(date, "MMM"),
      subscriptions: subscriptions.filter((sub) => monthKey(new Date(sub.started_at)) === key).length,
    };
  });

  const planMap = new Map<string, { value: number; subscriptions: number }>();
  for (const sub of activeSubs) {
    if (!sub.plan) continue;
    const mrrValue = monthlyValue(Number(sub.plan.price) * sub.quantity, sub.plan.interval, sub.plan.interval_count);
    const entry = planMap.get(sub.plan.name) ?? { value: 0, subscriptions: 0 };
    entry.value += mrrValue;
    entry.subscriptions += 1;
    planMap.set(sub.plan.name, entry);
  }
  const planMix = Array.from(planMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.value - a.value);

  const customerRevenue = new Map<string, { name: string; amount: number }>();
  for (const payment of payments) {
    if (!payment.customer_id) continue;
    const entry = customerRevenue.get(payment.customer_id) ?? {
      name: payment.customer?.name ?? "Customer",
      amount: 0,
    };
    entry.amount += Number(payment.amount);
    customerRevenue.set(payment.customer_id, entry);
  }
  const topCustomers = Array.from(customerRevenue.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const maxCustomerRevenue = topCustomers[0]?.amount ?? 1;

  const upcoming = subscriptions
    .filter((sub) => ["active", "trialing"].includes(sub.status) && new Date(sub.current_period_end) >= now)
    .sort((a, b) => new Date(a.current_period_end).getTime() - new Date(b.current_period_end).getTime())
    .slice(0, 5);

  const recentInvoices = invoices.slice(0, 6);
  const openQuotes = quotations.filter((quote) => quote.status === "sent");
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${profile.full_name?.split(" ")[0] ?? "there"}`}
        description={`${format(now, "EEEE, MMMM d")} · Here is what is happening across Brightloop today.`}
        actions={
          <>
            <BillingRunButton />
            <Button asChild size="sm">
              <Link href="/dashboard/invoices/new">
                <Plus className="size-4" /> New invoice
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Monthly recurring revenue"
          value={formatCurrency(mrr)}
          change={`${activeSubs.length} active`}
          trend="up"
          hint="subscriptions"
          icon={<CircleDollarSign className="size-4" />}
        />
        <StatCard
          label="Collected this month"
          value={formatCurrency(collectedThisMonth)}
          change={`${collectionChange >= 0 ? "+" : ""}${collectionChange.toFixed(1)}%`}
          trend={collectionChange >= 0 ? "up" : "down"}
          hint="vs last month"
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label="Outstanding balance"
          value={formatCurrency(outstanding)}
          change={`${openInvoices.length} open`}
          trend="neutral"
          hint={overdue > 0 ? `· ${overdue} overdue` : "· all current"}
          icon={<Receipt className="size-4" />}
        />
        <StatCard
          label="New subscriptions"
          value={String(newSubsThisMonth)}
          change={`${customers.length} customers`}
          trend="up"
          hint="this month"
          icon={<Users className="size-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Revenue</CardTitle>
              <p className="text-[12px] text-muted-foreground">Collected payments vs billed invoices, last six months</p>
            </div>
            <ChartLegend />
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by plan</CardTitle>
            <p className="text-[12px] text-muted-foreground">Active subscriptions, normalized to monthly</p>
          </CardHeader>
          <CardContent>
            <PlanMixChart data={planMix} total={mrr} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Subscription growth</CardTitle>
            <p className="text-[12px] text-muted-foreground">New subscriptions per month</p>
          </CardHeader>
          <CardContent>
            <GrowthChart data={growthData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Top customers</CardTitle>
              <p className="text-[12px] text-muted-foreground">By lifetime collected revenue</p>
            </div>
            <CreditCard className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            {topCustomers.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted-foreground">No payments recorded yet.</p>
            ) : (
              topCustomers.map((customer) => (
                <div key={customer.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="truncate font-medium">{customer.name}</span>
                    <span className="tabular-nums text-muted-foreground">{formatCurrency(customer.amount)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${Math.max((customer.amount / maxCustomerRevenue) * 100, 4)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Upcoming renewals</CardTitle>
              <p className="text-[12px] text-muted-foreground">Next billing periods</p>
            </div>
            <CalendarClock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted-foreground">No renewals scheduled.</p>
            ) : (
              upcoming.map((sub) => (
                <Link
                  key={sub.id}
                  href="/dashboard/subscriptions"
                  className="flex items-center justify-between gap-2 rounded-lg p-1.5 transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium">{sub.customer?.name ?? "Customer"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{sub.plan?.name ?? "Plan"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-medium tabular-nums">{formatDate(sub.current_period_end, "MMM d")}</p>
                    <p className="text-[10px] text-muted-foreground">{fromNow(sub.current_period_end)}</p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent invoices</CardTitle>
            <p className="text-[12px] text-muted-foreground">
              {openQuotes.length} quotation{openQuotes.length === 1 ? "" : "s"} awaiting a response
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/invoices">
              View all <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Invoice</th>
                  <th className="px-5 py-2.5 font-medium">Customer</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Issued</th>
                  <th className="px-5 py-2.5 text-right font-medium">Total</th>
                  <th className="w-10 px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-[13px] text-muted-foreground">
                      No invoices yet. Generate one with the billing run.
                    </td>
                  </tr>
                ) : (
                  recentInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/invoices/${invoice.id}`} className="font-medium hover:text-primary hover:underline">
                          {invoice.number}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-[13px]">{invoice.customer?.name ?? "—"}</td>
                      <td className="px-5 py-3"><StatusBadge value={invoice.status} /></td>
                      <td className="px-5 py-3 text-[12px] text-muted-foreground">{formatDate(invoice.issue_date)}</td>
                      <td className="px-5 py-3 text-right text-[13px] font-medium tabular-nums">
                        {formatCurrency(Number(invoice.total))}
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/invoices/${invoice.id}`} className="text-muted-foreground hover:text-foreground">
                          <ArrowUpRight className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <FileText className="size-3" /> All figures are live from Supabase, calculated with row-level security applied for {profile.role}.
      </p>
    </div>
  );
}
