import Link from "next/link";
import { Download, Plus, Receipt } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { DataTable, type TableColumn, type TableRowData } from "@/components/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecordPaymentDialog } from "@/components/record-payment-dialog";
import { Button } from "@/components/ui/button";

export default async function InvoicesPage() {
  const { supabase, profile } = await requireProfile();
  const canManage = profile.role !== "customer";

  const { data } = await supabase
    .from("invoices")
    .select("id, number, status, issue_date, due_date, total, amount_paid, currency, customer:customers(id,name,email)")
    .order("issue_date", { ascending: false })
    .limit(300);

  const invoices = (data ?? []) as unknown as Array<{
    id: string;
    number: string;
    status: string;
    issue_date: string;
    due_date: string;
    total: number;
    amount_paid: number;
    currency: string;
    customer: { id: string; name: string; email: string } | null;
  }>;

  const open = invoices.filter((invoice) => invoice.status === "open");
  const outstanding = open.reduce((sum, invoice) => sum + Number(invoice.total) - Number(invoice.amount_paid), 0);
  const paid = invoices.filter((invoice) => invoice.status === "paid");
  const paidTotal = paid.reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const overdue = open.filter((invoice) => new Date(`${invoice.due_date}T23:59:59`) < new Date()).length;

  const outstandingOptions = open
    .filter((invoice) => Number(invoice.total) - Number(invoice.amount_paid) > 0)
    .map((invoice) => ({
      value: invoice.id,
      label: `${invoice.number} · ${invoice.customer?.name ?? "Customer"} · ${formatCurrency(
        Number(invoice.total) - Number(invoice.amount_paid),
        invoice.currency
      )} open`,
    }));

  const rows: TableRowData[] = invoices.map((invoice) => {
    const balance = Number(invoice.total) - Number(invoice.amount_paid);
    const actions: TableRowData["_actions"] = [];
    if (canManage) {
      if (invoice.status === "open" && balance > 0) {
        actions.push({
          label: "Mark as paid",
          action: "invoice.mark_paid",
          confirm: `Record the remaining ${formatCurrency(balance)} as paid using "other" as the method? You can record a card or transfer payment from the invoice page for a full audit trail.`,
        });
      }
      if (invoice.status !== "paid" && invoice.status !== "void") {
        actions.push({
          label: "Void invoice",
          action: "invoice.void",
          confirm: "Voiding keeps the invoice number for audit purposes but removes it from outstanding balances.",
          destructive: true,
        });
      }
      if (invoice.status === "void") {
        actions.push({ label: "Reopen invoice", action: "invoice.mark_open", confirm: "Reopen this invoice as collectible?" });
      }
    }
    return {
      id: invoice.id,
      _href: `/dashboard/invoices/${invoice.id}`,
      _actions: actions,
      number: invoice.number,
      customer: invoice.customer?.name ?? "—",
      customerEmail: invoice.customer?.email ?? "",
      status: invoice.status,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      total: Number(invoice.total),
      balance,
    };
  });

  const columns: TableColumn[] = [
    { key: "number", header: "Invoice", kind: "link" },
    { key: "customer", header: "Customer", kind: "entity", subKey: "customerEmail" },
    { key: "status", header: "Status", kind: "badge" },
    { key: "issue_date", header: "Issued", kind: "date" },
    { key: "due_date", header: "Due", kind: "date" },
    { key: "total", header: "Total", kind: "currency", align: "right" },
    { key: "balance", header: "Balance", kind: "currency", align: "right" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description={canManage ? "Issue, collect and reconcile customer invoices." : "Your invoices and payment history."}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/api/export/invoices" prefetch={false}>
                <Download className="size-3.5" /> Export
              </Link>
            </Button>
            {canManage ? (
              <>
                <RecordPaymentDialog invoices={outstandingOptions} variant="outline" />
                <Button size="sm" asChild>
                  <Link href="/dashboard/invoices/new">
                    <Plus className="size-4" /> New invoice
                  </Link>
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} hint={`${open.length} open invoices`} icon={<Receipt className="size-4" />} />
        <StatCard label="Overdue" value={String(overdue)} hint="past due date" trend={overdue > 0 ? "down" : "neutral"} />
        <StatCard label="Collected" value={formatCurrency(paidTotal)} hint={`${paid.length} paid invoices`} trend="up" />
        <StatCard label="Total invoiced" value={formatCurrency(invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0))} hint={`${invoices.length} invoices`} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        searchPlaceholder="Search invoice number, customer, status…"
        emptyTitle={canManage ? "No invoices yet" : "No invoices for your account"}
        emptyDescription={
          canManage
            ? "Generate invoices from subscriptions or create one manually."
            : "Invoices will appear here as soon as they are issued."
        }
      />
    </div>
  );
}
