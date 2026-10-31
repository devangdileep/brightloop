import Link from "next/link";
import { CircleDollarSign, FileText, Plus, Send } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { DataTable, type TableColumn, type TableRowData } from "@/components/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";

export default async function QuotationsPage() {
  const { supabase } = await requireStaff();

  const { data } = await supabase
    .from("quotations")
    .select("id, number, status, issue_date, valid_until, total, customer:customers(id,name,email)")
    .order("issue_date", { ascending: false })
    .limit(300);

  const quotations = (data ?? []) as unknown as Array<{
    id: string;
    number: string;
    status: string;
    issue_date: string;
    valid_until: string;
    total: number;
    customer: { id: string; name: string; email: string } | null;
  }>;

  const open = quotations.filter((quote) => ["draft", "sent"].includes(quote.status));
  const openValue = open.reduce((sum, quote) => sum + Number(quote.total), 0);
  const accepted = quotations.filter((quote) => quote.status === "accepted");
  const winRate = quotations.length
    ? (accepted.length / quotations.filter((quote) => ["accepted", "declined", "expired"].includes(quote.status)).length) * 100
    : 0;

  const rows: TableRowData[] = quotations.map((quote) => {
    const actions: TableRowData["_actions"] = [];
    if (quote.status === "draft") {
      actions.push({ label: "Mark as sent", action: "quotation.send", confirm: "Mark this quotation as sent to the customer?" });
    }
    if (["draft", "sent"].includes(quote.status)) {
      actions.push({ label: "Accept quotation", action: "quotation.accept", confirm: "Mark this quotation as accepted?" });
      actions.push({
        label: "Decline quotation",
        action: "quotation.decline",
        confirm: "Mark this quotation as declined?",
        destructive: true,
      });
    }
    return {
      id: quote.id,
      _href: `/dashboard/quotations/${quote.id}`,
      _actions: actions,
      number: quote.number,
      customer: quote.customer?.name ?? "—",
      email: quote.customer?.email ?? "",
      status: quote.status,
      issue_date: quote.issue_date,
      valid_until: quote.valid_until,
      total: Number(quote.total),
    };
  });

  const columns: TableColumn[] = [
    { key: "number", header: "Quotation", kind: "link" },
    { key: "customer", header: "Customer", kind: "entity", subKey: "email" },
    { key: "status", header: "Status", kind: "badge" },
    { key: "issue_date", header: "Issued", kind: "date" },
    { key: "valid_until", header: "Valid until", kind: "date" },
    { key: "total", header: "Value", kind: "currency", align: "right" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        description="Build proposals, send them, and convert accepted work into invoices."
        actions={
          <Button size="sm" asChild>
            <Link href="/dashboard/quotations/new">
              <Plus className="size-4" /> New quotation
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open pipeline" value={formatCurrency(openValue)} hint={`${open.length} quotations`} icon={<CircleDollarSign className="size-4" />} />
        <StatCard label="Awaiting response" value={String(quotations.filter((quote) => quote.status === "sent").length)} hint="sent to customers" icon={<Send className="size-4" />} />
        <StatCard label="Accepted" value={String(accepted.length)} hint="ready to invoice" icon={<FileText className="size-4" />} />
        <StatCard label="Win rate" value={`${Number.isFinite(winRate) ? winRate.toFixed(0) : 0}%`} hint="accepted vs closed" trend="up" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        searchPlaceholder="Search quotation number, customer, status…"
        emptyTitle="No quotations yet"
        emptyDescription="Create a quotation with multiple line items, tax and discounts."
      />
    </div>
  );
}
