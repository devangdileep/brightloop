import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Download,
  Mail,
  Receipt,
  Send,
  Wallet,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { RecordPaymentDialog } from "@/components/record-payment-dialog";
import { RowActionButton } from "@/components/row-action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, customer:customers(*), items:invoice_items(*), subscription:subscriptions(id,status)")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) notFound();

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, method, reference, paid_at, notes, recorded_by")
    .eq("invoice_id", id)
    .order("paid_at", { ascending: false });

  const customer = invoice.customer as {
    id: string;
    name: string;
    email: string;
    company: string | null;
    address: string | null;
    tax_id: string | null;
  } | null;
  const items = (invoice.items ?? []) as unknown as Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  const paymentList = payments ?? [];
  const balance = Number(invoice.total) - Number(invoice.amount_paid);
  const canManage = profile.role !== "customer";
  const paidPercent = Number(invoice.total) > 0 ? Math.min((Number(invoice.amount_paid) / Number(invoice.total)) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link href="/dashboard/invoices">
            <ArrowLeft className="size-3.5" /> Invoices
          </Link>
        </Button>
        <PageHeader
          title={invoice.number}
          description={`Issued ${formatDate(invoice.issue_date)} · due ${formatDate(invoice.due_date)}`}
          actions={
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
                  <Download className="size-3.5" /> PDF
                </a>
              </Button>
              {canManage && balance > 0 && invoice.status !== "void" ? (
                <RecordPaymentDialog
                  invoices={[{ value: invoice.id, label: `${invoice.number} · ${customer?.name ?? "Customer"}` }]}
                  defaultInvoiceId={invoice.id}
                  defaultAmount={balance}
                  label="Record payment"
                />
              ) : null}
              {canManage && invoice.status === "open" && balance > 0 ? (
                <RowActionButton
                  label="Mark paid"
                  action="invoice.mark_paid"
                  id={invoice.id}
                  variant="outline"
                  confirm="Record the remaining balance as paid using the 'other' method?"
                />
              ) : null}
              {canManage && invoice.status !== "void" && invoice.status !== "paid" ? (
                <RowActionButton
                  label="Void"
                  action="invoice.void"
                  id={invoice.id}
                  variant="ghost"
                  confirm="Void this invoice? The number is retained for audit history."
                />
              ) : null}
            </>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-5 py-4">
        <StatusBadge value={invoice.status} />
        <div className="h-4 w-px bg-border" />
        <p className="text-[13px] text-muted-foreground">
          {invoice.status === "paid"
            ? "Paid in full — thank you."
            : invoice.status === "void"
              ? "This invoice has been voided."
              : `${formatCurrency(balance, invoice.currency)} outstanding`}
        </p>
        {invoice.status === "open" ? (
          <span className="text-[12px] text-muted-foreground">
            ·{" "}
            {new Date(`${invoice.due_date}T23:59:59`) < new Date()
              ? "overdue"
              : `due ${formatDate(invoice.due_date)}`}
          </span>
        ) : null}
        <div className="ml-auto w-40">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPercent}%` }} />
          </div>
          <p className="mt-1 text-right text-[10px] text-muted-foreground">
            {formatCurrency(Number(invoice.amount_paid), invoice.currency)} paid
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Invoice details</CardTitle>
              <p className="text-[12px] text-muted-foreground">
                {invoice.period_start ? `Billing period ${formatDate(invoice.period_start)} – ${formatDate(invoice.period_end)}` : "One-off invoice"}
              </p>
            </div>
            {invoice.subscription ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/dashboard/subscriptions/${invoice.subscription.id}`}>
                  <Send className="size-3.5" /> Subscription
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Description</th>
                  <th className="px-5 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-5 py-2.5 text-right font-medium">Unit price</th>
                  <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-5 py-3 text-[13px]">{item.description}</td>
                    <td className="px-5 py-3 text-right text-[12px] tabular-nums">{Number(item.quantity)}</td>
                    <td className="px-5 py-3 text-right text-[12px] tabular-nums">{formatCurrency(Number(item.unit_price), invoice.currency)}</td>
                    <td className="px-5 py-3 text-right text-[12px] font-medium tabular-nums">{formatCurrency(Number(item.amount), invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto w-full max-w-xs space-y-2 border-t p-5 text-[13px]">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums text-foreground">{formatCurrency(Number(invoice.subtotal), invoice.currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="tabular-nums text-foreground">−{formatCurrency(Number(invoice.discount_total), invoice.currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span className="tabular-nums text-foreground">{formatCurrency(Number(invoice.tax_total), invoice.currency)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(Number(invoice.total), invoice.currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Amount paid</span>
                <span className="tabular-nums text-foreground">{formatCurrency(Number(invoice.amount_paid), invoice.currency)}</span>
              </div>
              <div className="flex justify-between font-medium text-rose-600">
                <span>Balance</span>
                <span className="tabular-nums">{formatCurrency(balance, invoice.currency)}</span>
              </div>
            </div>
            {invoice.notes ? (
              <div className="border-t px-5 py-4">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="mt-1 text-[12px] text-muted-foreground">{invoice.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Billed to</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[12.5px]">
              <p className="font-medium">{customer?.name}</p>
              {customer?.company ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="size-3.5" /> {customer.company}
                </p>
              ) : null}
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-3.5" /> {customer?.email}
              </p>
              {customer?.address ? <p className="text-muted-foreground">{customer.address}</p> : null}
              {customer?.tax_id ? <p className="font-mono text-[11px] text-muted-foreground">Tax ID: {customer.tax_id}</p> : null}
              <div className="border-t pt-3">
                <Button asChild variant="link" size="sm" className="h-auto p-0">
                  <Link href={`/dashboard/customers/${customer?.id}`}>View customer profile →</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[12px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice number</span>
                <span className="font-mono text-[11px]">{invoice.number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currency</span>
                <span>{invoice.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Issued</span>
                <span className="flex items-center gap-1"><CalendarDays className="size-3" />{formatDate(invoice.issue_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due</span>
                <span>{formatDate(invoice.due_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PDF stored</span>
                <span>{invoice.pdf_path ? "Yes" : "On download"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Payments</CardTitle>
            <p className="text-[12px] text-muted-foreground">{paymentList.length} payment{paymentList.length === 1 ? "" : "s"} recorded</p>
          </div>
          {canManage && balance > 0 && invoice.status !== "void" ? (
            <RecordPaymentDialog
              invoices={[{ value: invoice.id, label: `${invoice.number} · ${customer?.name ?? "Customer"}` }]}
              defaultInvoiceId={invoice.id}
              defaultAmount={balance}
              label="Add payment"
              variant="outline"
            />
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {paymentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 border-t py-12 text-center">
              <Wallet className="size-5 text-muted-foreground" />
              <p className="text-[13px] text-muted-foreground">No payments recorded for this invoice.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/30 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Method</th>
                  <th className="px-5 py-2.5 font-medium">Reference</th>
                  <th className="px-5 py-2.5 font-medium">Notes</th>
                  <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {paymentList.map((payment) => (
                  <tr key={payment.id} className="border-b last:border-0">
                    <td className="px-5 py-3 text-[12px] text-muted-foreground">{formatDate(payment.paid_at, "MMM d, yyyy HH:mm")}</td>
                    <td className="px-5 py-3"><StatusBadge value={payment.method} /></td>
                    <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground">{payment.reference ?? "—"}</td>
                    <td className="px-5 py-3 text-[12px] text-muted-foreground">{payment.notes ?? "—"}</td>
                    <td className="px-5 py-3 text-right text-[13px] font-medium tabular-nums">
                      {formatCurrency(Number(payment.amount), invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button asChild variant="ghost" size="sm">
          <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
            <Receipt className="size-3.5" /> Download invoice PDF
          </a>
        </Button>
      </div>
    </div>
  );
}
