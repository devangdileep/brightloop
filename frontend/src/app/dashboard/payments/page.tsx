import Link from "next/link";
import { Download, Wallet } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { DataTable, type TableColumn, type TableRowData } from "@/components/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecordPaymentDialog } from "@/components/record-payment-dialog";
import { Button } from "@/components/ui/button";

export default async function PaymentsPage() {
  const { supabase, profile } = await requireProfile();
  const canManage = profile.role !== "customer";

  const [paymentsRes, invoicesRes] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount, method, reference, paid_at, notes, customer:customers(id,name), invoice:invoices(id,number)")
      .order("paid_at", { ascending: false })
      .limit(400),
    supabase
      .from("invoices")
      .select("id, number, total, amount_paid, currency, customer:customers(name)")
      .in("status", ["open", "partially_paid", "overdue"])
      .order("issue_date", { ascending: false }),
  ]);

  const payments = (paymentsRes.data ?? []) as unknown as Array<{
    id: string;
    amount: number;
    method: string;
    reference: string | null;
    paid_at: string;
    notes: string | null;
    customer: { id: string; name: string } | null;
    invoice: { id: string; number: string } | null;
  }>;
  const outstandingInvoices = (invoicesRes.data ?? []) as unknown as Array<{
    id: string;
    number: string;
    total: number;
    amount_paid: number;
    currency: string;
    customer: { name: string } | null;
  }>;

  const total = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTotal = payments
    .filter((payment) => new Date(payment.paid_at) >= monthStart)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const cardPayments = payments.filter((payment) => payment.method === "card");
  const average = payments.length ? total / payments.length : 0;

  const invoiceOptions = outstandingInvoices
    .filter((invoice) => Number(invoice.total) - Number(invoice.amount_paid) > 0)
    .map((invoice) => ({
      value: invoice.id,
      label: `${invoice.number} · ${invoice.customer?.name ?? "Customer"} · ${formatCurrency(
        Number(invoice.total) - Number(invoice.amount_paid),
        invoice.currency
      )} open`,
    }));

  const rows: TableRowData[] = payments.map((payment) => ({
    id: payment.id,
    _actions:
      profile.role === "admin"
        ? [
            {
              label: "Delete payment",
              action: "payment.delete",
              confirm: "Deleting a payment reopens the invoice balance. This cannot be undone.",
              destructive: true,
            },
          ]
        : [],
    paid_at: payment.paid_at,
    invoice: payment.invoice?.number ?? "—",
    customer: payment.customer?.name ?? "—",
    method: payment.method,
    reference: payment.reference ?? "—",
    amount: Number(payment.amount),
  }));

  const columns: TableColumn[] = [
    { key: "paid_at", header: "Date", kind: "date" },
    { key: "invoice", header: "Invoice" },
    { key: "customer", header: "Customer" },
    { key: "method", header: "Method", kind: "badge" },
    { key: "reference", header: "Reference" },
    { key: "amount", header: "Amount", kind: "currency", align: "right" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description={canManage ? "Every payment recorded against an invoice, with a full audit trail." : "Payments received on your account."}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/api/export/payments" prefetch={false}>
                <Download className="size-3.5" /> Export
              </Link>
            </Button>
            {canManage ? <RecordPaymentDialog invoices={invoiceOptions} /> : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total collected" value={formatCurrency(total)} hint={`${payments.length} payments`} icon={<Wallet className="size-4" />} />
        <StatCard label="This month" value={formatCurrency(monthTotal)} hint="payments received" trend="up" />
        <StatCard label="Average payment" value={formatCurrency(average)} hint="per transaction" />
        <StatCard label="Card payments" value={String(cardPayments.length)} hint={`${Math.round((cardPayments.length / Math.max(payments.length, 1)) * 100)}% of volume`} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        searchPlaceholder="Search invoice, customer, reference…"
        emptyTitle="No payments recorded"
        emptyDescription={canManage ? "Record your first payment against an open invoice." : "Payments will appear here when received."}
      />
    </div>
  );
}
