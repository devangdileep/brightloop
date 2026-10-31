import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CircleDollarSign, CreditCard, PauseCircle, PlayCircle, Receipt, ShieldCheck, TicketPercent } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { formatCurrency, formatDate, intervalLabel, monthlyValue } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { RowActionButton } from "@/components/row-action-button";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(
      "*, plan:plans(name,price,interval,interval_count,trial_days,features,description), customer:customers(id,name,email,company), discount:discounts(code,type,value), tax:taxes(name,rate)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!subscription) notFound();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, number, status, issue_date, due_date, total, amount_paid")
    .eq("subscription_id", id)
    .order("issue_date", { ascending: false });

  const plan = subscription.plan as {
    name: string;
    price: number;
    interval: string;
    interval_count: number;
    trial_days: number;
    features: string[] | null;
    description: string | null;
  } | null;
  const customer = subscription.customer as { id: string; name: string; email: string; company: string | null } | null;
  const discount = subscription.discount as { code: string; type: string; value: number } | null;
  const tax = subscription.tax as { name: string; rate: number } | null;
  const invoiceList = invoices ?? [];

  const value = Number(plan?.price ?? 0) * Number(subscription.quantity);
  const mrr = plan ? monthlyValue(value, plan.interval, plan.interval_count) : 0;
  const canCancel = subscription.status !== "canceled";

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link href="/dashboard/subscriptions">
            <ArrowLeft className="size-3.5" /> Subscriptions
          </Link>
        </Button>
        <PageHeader
          title={`${customer?.name ?? "Subscription"} · ${plan?.name ?? "Plan"}`}
          description={`Started ${formatDate(subscription.started_at)} · ${intervalLabel(plan?.interval ?? "monthly", plan?.interval_count ?? 1)}`}
          actions={
            <>
              {subscription.status === "paused" ? (
                <RowActionButton label="Resume" action="subscription.resume" id={subscription.id} confirm="Resume billing for this subscription?" icon={<PlayCircle className="size-3.5" />} />
              ) : canCancel ? (
                <RowActionButton label="Pause" action="subscription.pause" id={subscription.id} confirm="Pause this subscription? Invoice generation stops until resumed." icon={<PauseCircle className="size-3.5" />} />
              ) : null}
              {canCancel ? (
                subscription.cancel_at_period_end ? (
                  <RowActionButton label="Reverse cancellation" action="subscription.resume_cancel" id={subscription.id} variant="outline" confirm="Keep this subscription active after the current period?" />
                ) : (
                  <RowActionButton
                    label="Cancel at period end"
                    action="subscription.cancel"
                    id={subscription.id}
                    variant="ghost"
                    confirm="The subscription remains active until the current period ends, then cancels."
                  />
                )
              ) : null}
              <RowActionButton
                label="Generate invoice"
                action="subscription.generate_invoice"
                id={subscription.id}
                confirm="Generate an invoice for the current period and advance the renewal date?"
                redirectTemplate="/dashboard/invoices/%s"
                icon={<Receipt className="size-3.5" />}
              />
            </>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contract value" value={formatCurrency(value)} hint={`per ${plan?.interval ?? "period"}`} icon={<CircleDollarSign className="size-4" />} />
        <StatCard label="Normalized MRR" value={formatCurrency(mrr)} hint="monthly equivalent" icon={<CreditCard className="size-4" />} />
        <StatCard label="Seats" value={String(subscription.quantity)} hint="quantity" />
        <StatCard
          label="Next renewal"
          value={formatDate(subscription.current_period_end, "MMM d")}
          hint={subscription.cancel_at_period_end ? "cancels after this period" : "auto-renews"}
          icon={<CalendarClock className="size-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Subscription details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-[13px]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge value={subscription.status} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">Billing interval</span>
                <span className="capitalize">{plan?.interval ?? "—"} × {plan?.interval_count ?? 1}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">Current period</span>
                <span>{formatDate(subscription.current_period_start)} – {formatDate(subscription.current_period_end)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">Trial end</span>
                <span>{subscription.trial_end ? formatDate(subscription.trial_end) : "No trial"}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="flex items-center gap-1.5 text-muted-foreground"><TicketPercent className="size-3.5" /> Discount</span>
                <span>{discount ? `${discount.code} · ${discount.type === "percentage" ? `${discount.value}%` : formatCurrency(Number(discount.value))}` : "None"}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="flex items-center gap-1.5 text-muted-foreground"><ShieldCheck className="size-3.5" /> Tax</span>
                <span>{tax ? `${tax.name} (${tax.rate}%)` : "None"}</span>
              </div>
            </div>
            {subscription.cancel_at_period_end ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                This subscription is set to cancel on {formatDate(subscription.current_period_end)}. Reverse the cancellation to keep it active.
              </p>
            ) : null}
            {subscription.notes ? (
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Internal notes</p>
                <p className="mt-1 text-[12px] text-muted-foreground">{subscription.notes}</p>
              </div>
            ) : null}
            {plan?.features?.length ? (
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Plan features</p>
                <div className="flex flex-wrap gap-1.5">
                  {plan.features.map((feature) => (
                    <span key={feature} className="rounded-full border bg-card px-2 py-0.5 text-[11px]">{feature}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-[13px]">
            <p className="text-base font-medium">{customer?.name}</p>
            <p className="text-[12px] text-muted-foreground">{customer?.company ?? "—"}</p>
            <p className="text-[12px] text-muted-foreground">{customer?.email}</p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={`/dashboard/customers/${customer?.id}`}>View customer</Link>
            </Button>
            <div className="border-t pt-3 text-[12px]">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Subscription ID</span>
                <span className="font-mono text-[10px]">{subscription.id.slice(0, 8)}…</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(subscription.created_at)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Invoice history</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/invoices">All invoices</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {invoiceList.length === 0 ? (
            <p className="border-t px-5 py-10 text-center text-[13px] text-muted-foreground">
              No invoices yet. Use “Generate invoice” to bill the current period.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Invoice</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Issued</th>
                  <th className="px-5 py-2.5 font-medium">Due</th>
                  <th className="px-5 py-2.5 text-right font-medium">Total</th>
                  <th className="px-5 py-2.5 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {invoiceList.map((invoice) => (
                  <tr key={invoice.id} className="border-b last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/invoices/${invoice.id}`} className="font-medium hover:text-primary hover:underline">
                        {invoice.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3"><StatusBadge value={invoice.status} /></td>
                    <td className="px-5 py-3 text-[12px] text-muted-foreground">{formatDate(invoice.issue_date)}</td>
                    <td className="px-5 py-3 text-[12px] text-muted-foreground">{formatDate(invoice.due_date)}</td>
                    <td className="px-5 py-3 text-right text-[12px] tabular-nums">{formatCurrency(Number(invoice.total))}</td>
                    <td className="px-5 py-3 text-right text-[12px] tabular-nums">
                      {formatCurrency(Number(invoice.total) - Number(invoice.amount_paid))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
