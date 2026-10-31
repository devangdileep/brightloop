import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  Download,
  LifeBuoy,
  Mail,
  Receipt,
  Sparkles,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { formatCurrency, formatDate, intervalLabel } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { PortalSubscriptionActions } from "@/components/portal-subscription-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default async function PortalPage() {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "customer") redirect("/dashboard");

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!customer) {
    return (
      <div className="space-y-6">
        <PageHeader title={`Welcome, ${profile.full_name?.split(" ")[0] ?? "there"}`} description="Your Brightloop account" />
        <Card>
          <EmptyState
            icon={LifeBuoy}
            title="Your billing account is not linked yet"
            description="A member of the Brightloop team needs to connect your login to your customer record. Contact billing@brightloop.io and we will sort it out."
            action={
              <Button asChild size="sm">
                <a href="mailto:billing@brightloop.io">
                  <Mail className="size-4" /> Contact billing
                </a>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const [subsRes, invoicesRes, paymentsRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, status, quantity, current_period_end, cancel_at_period_end, started_at, plan:plans(name,price,interval,interval_count,features,description)")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, number, status, issue_date, due_date, total, amount_paid, currency")
      .eq("customer_id", customer.id)
      .order("issue_date", { ascending: false })
      .limit(50),
    supabase
      .from("payments")
      .select("id, amount, method, paid_at, reference, invoice:invoices(number)")
      .eq("customer_id", customer.id)
      .order("paid_at", { ascending: false })
      .limit(20),
  ]);

  const subscriptions = (subsRes.data ?? []) as unknown as Array<{
    id: string;
    status: string;
    quantity: number;
    current_period_end: string;
    cancel_at_period_end: boolean;
    started_at: string;
    plan: { name: string; price: number; interval: string; interval_count: number; features: string[] | null; description: string | null } | null;
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

  const active = subscriptions.filter((sub) => sub.status === "active" || sub.status === "trialing");
  const outstanding = invoices
    .filter((invoice) => invoice.status === "open")
    .reduce((sum, invoice) => sum + Number(invoice.total) - Number(invoice.amount_paid), 0);
  const lifetime = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const nextRenewal = active
    .map((sub) => sub.current_period_end)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${profile.full_name?.split(" ")[0] ?? customer.name}`}
        description={`${customer.name} · ${customer.email}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href="mailto:billing@brightloop.io">
              <LifeBuoy className="size-3.5" /> Get help
            </a>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active subscriptions" value={String(active.length)} hint={`${subscriptions.length} total`} icon={<Sparkles className="size-4" />} />
        <StatCard label="Next renewal" value={nextRenewal ? formatDate(nextRenewal, "MMM d") : "—"} hint={nextRenewal ? formatDate(nextRenewal) : "no active plan"} icon={<CalendarClock className="size-4" />} />
        <StatCard label="Outstanding balance" value={formatCurrency(outstanding)} hint={`${invoices.filter((invoice) => invoice.status === "open").length} open invoices`} icon={<Receipt className="size-4" />} />
        <StatCard label="Lifetime paid" value={formatCurrency(lifetime)} hint="thank you!" icon={<CircleDollarSign className="size-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Your subscriptions</CardTitle>
              <p className="text-[12px] text-muted-foreground">Plans and add-ons attached to your account</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {subscriptions.length === 0 ? (
                <EmptyState icon={Sparkles} title="No subscriptions yet" description="Your plans will appear here once your account is set up." />
              ) : (
                subscriptions.map((sub) => (
                  <div key={sub.id} className="rounded-xl border p-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[14px] font-medium">{sub.plan?.name ?? "Plan"}</p>
                          <StatusBadge value={sub.status} />
                          {sub.cancel_at_period_end ? <StatusBadge value="canceled" /> : null}
                        </div>
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          {sub.quantity} seats · {intervalLabel(sub.plan?.interval ?? "monthly", sub.plan?.interval_count ?? 1)} · renews{" "}
                          {formatDate(sub.current_period_end)}
                        </p>
                        {sub.plan?.description ? (
                          <p className="mt-2 max-w-lg text-[12px] text-muted-foreground">{sub.plan.description}</p>
                        ) : null}
                        {sub.plan?.features?.length ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {sub.plan.features.map((feature) => (
                              <span key={feature} className="rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                                {feature}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-lg font-semibold tracking-tight">
                          {formatCurrency(Number(sub.plan?.price ?? 0) * sub.quantity)}
                          <span className="text-[11px] font-normal text-muted-foreground">
                            /{sub.plan?.interval === "yearly" ? "yr" : sub.plan?.interval === "quarterly" ? "qtr" : "mo"}
                          </span>
                        </p>
                        <div className="mt-2">
                          <PortalSubscriptionActions
                            subscriptionId={sub.id}
                            cancelAtPeriodEnd={sub.cancel_at_period_end}
                            periodEnd={formatDate(sub.current_period_end)}
                            status={sub.status}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Invoices</CardTitle>
                <p className="text-[12px] text-muted-foreground">Download PDF copies or check balances</p>
              </div>
              <Receipt className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <p className="border-t px-5 py-10 text-center text-[13px] text-muted-foreground">No invoices yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y bg-muted/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-2.5 font-medium">Invoice</th>
                        <th className="px-5 py-2.5 font-medium">Status</th>
                        <th className="px-5 py-2.5 font-medium">Due</th>
                        <th className="px-5 py-2.5 text-right font-medium">Total</th>
                        <th className="px-5 py-2.5 text-right font-medium">Balance</th>
                        <th className="px-5 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b last:border-0">
                          <td className="px-5 py-3">
                            <Link href={`/dashboard/invoices/${invoice.id}`} className="font-medium hover:text-primary hover:underline">
                              {invoice.number}
                            </Link>
                          </td>
                          <td className="px-5 py-3"><StatusBadge value={invoice.status} /></td>
                          <td className="px-5 py-3 text-[11px] text-muted-foreground">{formatDate(invoice.due_date)}</td>
                          <td className="px-5 py-3 text-right text-[12px] tabular-nums">{formatCurrency(Number(invoice.total), invoice.currency)}</td>
                          <td className="px-5 py-3 text-right text-[12px] tabular-nums">
                            {formatCurrency(Number(invoice.total) - Number(invoice.amount_paid), invoice.currency)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <a
                              href={`/api/invoices/${invoice.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              <Download className="size-3.5" /> PDF
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

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {payments.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-muted-foreground">No payments recorded yet.</p>
              ) : (
                payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <CreditCard className="size-3.5" />
                      </span>
                      <div>
                        <p className="text-[12px] font-medium">{payment.invoice?.number ?? "Payment"}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(payment.paid_at)} · {payment.method.replace("_", " ")}</p>
                      </div>
                    </div>
                    <span className="text-[12px] font-medium tabular-nums">{formatCurrency(Number(payment.amount))}</span>
                  </div>
                ))
              )}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/dashboard/payments">
                  View all payments <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[12px]">
              <p className="font-medium">{customer.name}</p>
              <p className="text-muted-foreground">{customer.email}</p>
              {customer.address ? <p className="text-muted-foreground">{customer.address}</p> : null}
              <div className="rounded-lg bg-muted/40 p-3 text-muted-foreground">
                Need to update your billing details or add a payment method? Email{" "}
                <a href="mailto:billing@brightloop.io" className="font-medium text-foreground underline underline-offset-2">
                  billing@brightloop.io
                </a>
                .
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
