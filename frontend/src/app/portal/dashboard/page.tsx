import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  Download,
  Receipt,
  Settings,
  Sparkles,
} from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { formatCurrency, formatDate, fromNow, intervalLabel } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

export default async function CustomerDashboardPage() {
  const { supabase, profile, user } = await requireCustomer();

  // Find linked customer record
  let { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // If unlinked by user_id, check if customer with same email exists and link
  if (!customer && profile.email) {
    const { data: matchedCustomer } = await supabase
      .from("customers")
      .select("*")
      .eq("email", profile.email)
      .maybeSingle();

    if (matchedCustomer) {
      await supabase
        .from("customers")
        .update({ user_id: user.id })
        .eq("id", matchedCustomer.id);
      customer = matchedCustomer;
    }
  }

  const customerId = customer?.id;

  const [subsRes, invoicesRes, paymentsRes] = await Promise.all([
    customerId
      ? supabase
          .from("subscriptions")
          .select("id, status, quantity, current_period_end, cancel_at_period_end, started_at, plan:plans(name, price, interval, interval_count)")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    customerId
      ? supabase
          .from("invoices")
          .select("id, number, status, issue_date, due_date, total, amount_paid, currency")
          .eq("customer_id", customerId)
          .order("issue_date", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    customerId
      ? supabase
          .from("payments")
          .select("id, amount, method, paid_at, reference, invoice:invoices(number)")
          .eq("customer_id", customerId)
          .order("paid_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const subscriptions = (subsRes.data ?? []) as unknown as Array<{
    id: string;
    status: string;
    quantity: number;
    current_period_end: string;
    cancel_at_period_end: boolean;
    started_at: string;
    plan: { name: string; price: number; interval: string; interval_count: number } | null;
  }>;

  const invoices = (invoicesRes.data ?? []) as unknown as Array<{
    id: string;
    number: string;
    status: string;
    issue_date: string;
    due_date: string;
    total: number;
    amount_paid: number;
    currency: string;
  }>;

  const payments = (paymentsRes.data ?? []) as unknown as Array<{
    id: string;
    amount: number;
    method: string;
    paid_at: string;
    reference: string | null;
    invoice: { number: string } | null;
  }>;

  const activeSubs = subscriptions.filter((s) => s.status === "active" || s.status === "trialing");
  const openInvoices = invoices.filter((i) => i.status === "open");
  const outstanding = openInvoices.reduce(
    (sum, inv) => sum + (Number(inv.total) - Number(inv.amount_paid)),
    0
  );
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const nextRenewal = activeSubs
    .map((s) => s.current_period_end)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

  const greeting = "Welcome back";
  const displayName = profile.full_name?.split(" ")[0] || customer?.name || "Customer";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${displayName}!`}
        description="Your customer billing portal — manage your active subscriptions, review invoices, and view receipts."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/portal/plans">
                <Boxes className="size-4 mr-1.5" /> Browse Plans
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/portal/invoices">
                <Receipt className="size-4 mr-1.5" /> My Invoices
              </Link>
            </Button>
          </div>
        }
      />

      {/* Overview Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Subscriptions"
          value={String(activeSubs.length)}
          hint={`${subscriptions.length} total contracts`}
          icon={<Sparkles className="size-4" />}
        />
        <StatCard
          label="Next Renewal Date"
          value={nextRenewal ? formatDate(nextRenewal, "MMM d, yyyy") : "No renewals"}
          hint={nextRenewal ? fromNow(nextRenewal) : "All plans up to date"}
          icon={<CalendarClock className="size-4" />}
        />
        <StatCard
          label="Pending Invoices"
          value={formatCurrency(outstanding)}
          hint={`${openInvoices.length} awaiting payment`}
          icon={<Receipt className="size-4" />}
        />
        <StatCard
          label="Total Payments Made"
          value={formatCurrency(totalPaid)}
          hint={`${payments.length} transactions`}
          icon={<CircleDollarSign className="size-4" />}
        />
      </div>

      {/* Main Grid: Subscriptions and Invoices */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Subscriptions list */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Your Active Subscriptions</CardTitle>
                <p className="text-[12px] text-muted-foreground">Current plans attached to your account</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/portal/subscriptions">
                  View all <ArrowRight className="size-3.5 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {subscriptions.length === 0 ? (
                <EmptyState
                  icon={Boxes}
                  title="No active subscriptions"
                  description="Explore our available software plans to get started with Brightloop."
                  action={
                    <Button asChild size="sm">
                      <Link href="/portal/plans">
                        <Boxes className="size-4 mr-1.5" /> View Available Plans
                      </Link>
                    </Button>
                  }
                />
              ) : (
                subscriptions.slice(0, 3).map((sub) => (
                  <div key={sub.id} className="flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{sub.plan?.name ?? "Subscription Plan"}</p>
                        <StatusBadge value={sub.status} />
                        {sub.cancel_at_period_end ? (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                            Cancels at period end
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {sub.quantity} seat{sub.quantity === 1 ? "" : "s"} · {intervalLabel(sub.plan?.interval ?? "monthly", sub.plan?.interval_count ?? 1)} · Renews {formatDate(sub.current_period_end)}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-base font-bold tabular-nums">
                        {formatCurrency(Number(sub.plan?.price ?? 0) * sub.quantity)}
                      </p>
                      <Link href="/portal/subscriptions" className="text-xs text-primary font-medium hover:underline">
                        Manage subscription →
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Recent Invoices</CardTitle>
                <p className="text-[12px] text-muted-foreground">Billing statements and payment status</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/portal/invoices">
                  View all <ArrowRight className="size-3.5 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <p className="p-6 text-center text-xs text-muted-foreground">No invoices generated yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/40 uppercase tracking-wider text-[10px] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Invoice</th>
                        <th className="px-4 py-2.5 font-semibold">Due Date</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Download</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invoices.slice(0, 5).map((inv) => (
                        <tr key={inv.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{inv.number}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.due_date)}</td>
                          <td className="px-4 py-3">
                            <StatusBadge value={inv.status} />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">
                            {formatCurrency(Number(inv.total), inv.currency)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a
                              href={`/api/invoices/${inv.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                            >
                              <Download className="size-3" /> PDF
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Profile & Recent Payments */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Billing Information</CardTitle>
              <Button asChild variant="ghost" size="icon-sm">
                <Link href="/portal/profile">
                  <Settings className="size-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="font-semibold text-sm">{profile.full_name || customer?.name}</p>
              <p className="text-muted-foreground">{profile.email}</p>
              {customer?.company ? <p className="text-muted-foreground">{customer.company}</p> : null}
              {customer?.address ? <p className="text-muted-foreground">{customer.address}</p> : null}
              {customer?.phone ? <p className="text-muted-foreground">{customer.phone}</p> : null}
              <div className="pt-2">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/portal/profile">Edit Billing Details</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Recent Receipts</CardTitle>
              <CreditCard className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-3">
              {payments.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">No payment records yet.</p>
              ) : (
                payments.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center justify-between border-b pb-2.5 last:border-0 last:pb-0 text-xs">
                    <div>
                      <p className="font-medium">{p.invoice?.number ?? "Payment Receipt"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(p.paid_at)} · {p.method}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums text-emerald-600">
                      {formatCurrency(Number(p.amount))}
                    </span>
                  </div>
                ))
              )}
              <Button asChild variant="ghost" size="sm" className="w-full text-xs">
                <Link href="/portal/payments">View All Payments →</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
