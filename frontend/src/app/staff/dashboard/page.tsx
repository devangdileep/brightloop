import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  FileText,
  Plus,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";
import { format } from "date-fns";
import { requireStaff } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function StaffDashboardPage() {
  const { supabase, profile } = await requireStaff();

  const now = new Date();

  // Parallel queries for staff metrics
  const [
    customersRes,
    subscriptionsRes,
    quotationsRes,
    invoicesRes,
    paymentsRes,
  ] = await Promise.all([
    supabase.from("customers").select("id, name, email, company, status, created_at").order("created_at", { ascending: false }),
    supabase.from("subscriptions").select("id, status, quantity, current_period_end, plan:plans(name, price, interval), customer:customers(name)").order("current_period_end", { ascending: true }),
    supabase.from("quotations").select("id, number, status, total, valid_until, customer:customers(name)").order("created_at", { ascending: false }),
    supabase.from("invoices").select("id, number, status, total, amount_paid, due_date, customer:customers(name)").order("issue_date", { ascending: false }),
    supabase.from("payments").select("id, amount, paid_at, method, customer:customers(name), invoice:invoices(number)").order("paid_at", { ascending: false }).limit(6),
  ]);

  const customers = customersRes.data ?? [];
  const subscriptions = (subscriptionsRes.data ?? []) as unknown as Array<{
    id: string;
    status: string;
    quantity: number;
    current_period_end: string;
    plan: { name: string; price: number; interval: string } | null;
    customer: { name: string } | null;
  }>;
  const quotations = (quotationsRes.data ?? []) as unknown as Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    valid_until: string;
    customer: { name: string } | null;
  }>;
  const invoices = (invoicesRes.data ?? []) as unknown as Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    amount_paid: number;
    due_date: string;
    customer: { name: string } | null;
  }>;
  const payments = (paymentsRes.data ?? []) as unknown as Array<{
    id: string;
    amount: number;
    paid_at: string;
    method: string;
    customer: { name: string } | null;
    invoice: { number: string } | null;
  }>;

  // Key operational metrics
  const activeSubs = subscriptions.filter((s) => s.status === "active" || s.status === "trialing");
  const pendingQuotes = quotations.filter((q) => q.status === "draft" || q.status === "sent");
  const openInvoices = invoices.filter((i) => i.status === "open");
  const overdueInvoices = openInvoices.filter((i) => new Date(`${i.due_date}T23:59:59`) < now);

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${profile.full_name?.split(" ")[0] ?? "Staff"}`}
        description={`${format(now, "EEEE, MMMM d, yyyy")} · Operational Dashboard`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/staff/quotations/new">
                <FileText className="size-4 mr-1.5" /> New Quote
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/staff/invoices/new">
                <Plus className="size-4 mr-1.5" /> New Invoice
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Managed Customers"
          value={String(customers.length)}
          change={`${customers.filter((c) => c.status === "active").length} active`}
          trend="up"
          hint="client accounts"
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Active Subscriptions"
          value={String(activeSubs.length)}
          change={`${subscriptions.length} total`}
          trend="up"
          hint="managed subscriptions"
          icon={<CheckCircle2 className="size-4" />}
        />
        <StatCard
          label="Pending Quotations"
          value={String(pendingQuotes.length)}
          change={`${quotations.filter((q) => q.status === "accepted").length} accepted`}
          trend="neutral"
          hint="awaiting conversion"
          icon={<FileCheck2 className="size-4" />}
        />
        <StatCard
          label="Invoices Awaiting Payment"
          value={String(openInvoices.length)}
          change={formatCurrency(openInvoices.reduce((sum, i) => sum + (Number(i.total) - Number(i.amount_paid)), 0))}
          trend="neutral"
          hint="open balance"
          icon={<Receipt className="size-4" />}
        />
        <StatCard
          label="Overdue Invoices"
          value={String(overdueInvoices.length)}
          change={overdueInvoices.length > 0 ? "Follow up needed" : "Clean pipeline"}
          trend={overdueInvoices.length > 0 ? "down" : "up"}
          hint="past due date"
          icon={<Clock className="size-4" />}
        />
        <StatCard
          label="Recent Payments"
          value={formatCurrency(payments.reduce((sum, p) => sum + Number(p.amount), 0))}
          change={`${payments.length} transactions`}
          trend="up"
          hint="latest records"
          icon={<Wallet className="size-4" />}
        />
      </div>

      {/* Operational Modules Quick Links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Customers", href: "/staff/customers", icon: Users, count: customers.length },
          { label: "Quotations", href: "/staff/quotations", icon: FileText, count: quotations.length },
          { label: "Subscriptions", href: "/staff/subscriptions", icon: CheckCircle2, count: subscriptions.length },
          { label: "Invoices", href: "/staff/invoices", icon: Receipt, count: invoices.length },
          { label: "Payments", href: "/staff/payments", icon: Wallet, count: payments.length },
        ].map((module) => (
          <Link
            key={module.label}
            href={module.href}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-all hover:bg-muted/40 hover:shadow-sm"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <module.icon className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold">{module.label}</p>
              <p className="text-[11px] text-muted-foreground">{module.count} records</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Grid: Pending Quotations & Invoices Awaiting Payment */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Quotations */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Quotations Requiring Follow-Up</CardTitle>
              <p className="text-[12px] text-muted-foreground">Draft and sent proposals ready for customer acceptance</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/staff/quotations">
                View all <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {pendingQuotes.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">No pending quotations.</p>
              ) : (
                pendingQuotes.slice(0, 5).map((q) => (
                  <div key={q.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                    <div>
                      <Link href={`/staff/quotations/${q.id}`} className="text-sm font-medium hover:underline">
                        {q.number}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {q.customer?.name ?? "Customer"} · Valid until {formatDate(q.valid_until)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(Number(q.total))}</p>
                      <StatusBadge value={q.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invoices Awaiting Payment */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Invoices Awaiting Payment</CardTitle>
              <p className="text-[12px] text-muted-foreground">Open invoices due for collection</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/staff/invoices">
                View all <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {openInvoices.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">All invoices are up to date!</p>
              ) : (
                openInvoices.slice(0, 5).map((inv) => {
                  const isOverdue = new Date(`${inv.due_date}T23:59:59`) < now;
                  return (
                    <div key={inv.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                      <div>
                        <Link href={`/staff/invoices/${inv.id}`} className="text-sm font-medium hover:underline">
                          {inv.number}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {inv.customer?.name ?? "Customer"} · Due {formatDate(inv.due_date)} {isOverdue ? <span className="text-destructive font-medium">(Overdue)</span> : null}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(Number(inv.total) - Number(inv.amount_paid))}
                        </p>
                        <StatusBadge value={isOverdue ? "past_due" : inv.status} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments Record */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent Customer Payments</CardTitle>
            <p className="text-[12px] text-muted-foreground">Confirmed payment transactions</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/staff/payments">
              View all <ArrowRight className="size-3.5 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {payments.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">No recent payments recorded.</p>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4 hover:bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <CreditCard className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{p.customer?.name ?? "Customer"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.invoice?.number ?? "Payment"} · {formatDate(p.paid_at)} · {p.method}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 tabular-nums">
                    +{formatCurrency(Number(p.amount))}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
