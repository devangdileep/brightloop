import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Check, Mail, Send } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { RowActionButton } from "@/components/row-action-button";
import { ConvertQuotationButton } from "@/components/convert-quotation-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();

  const { data: quotation } = await supabase
    .from("quotations")
    .select("*, customer:customers(*), items:quotation_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (!quotation) notFound();

  const customer = quotation.customer as {
    id: string;
    name: string;
    email: string;
    company: string | null;
    address: string | null;
  } | null;
  const items = ((quotation.items ?? []) as unknown as Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    sort_order: number;
  }>).sort((a, b) => a.sort_order - b.sort_order);

  const isOpen = ["draft", "sent"].includes(quotation.status);
  const expired = quotation.status === "expired" || (isOpen && new Date(quotation.valid_until) < new Date());

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link href="/dashboard/quotations">
            <ArrowLeft className="size-3.5" /> Quotations
          </Link>
        </Button>
        <PageHeader
          title={quotation.number}
          description={`Issued ${formatDate(quotation.issue_date)} · valid until ${formatDate(quotation.valid_until)}`}
          actions={
            <>
              {quotation.status === "draft" ? (
                <RowActionButton
                  label="Mark as sent"
                  action="quotation.send"
                  id={quotation.id}
                  variant="outline"
                  confirm="Mark this quotation as sent to the customer?"
                  icon={<Send className="size-3.5" />}
                />
              ) : null}
              {isOpen ? (
                <>
                  <RowActionButton
                    label="Accept"
                    action="quotation.accept"
                    id={quotation.id}
                    variant="outline"
                    confirm="Mark this quotation as accepted?"
                    icon={<Check className="size-3.5" />}
                  />
                  <RowActionButton
                    label="Decline"
                    action="quotation.decline"
                    id={quotation.id}
                    variant="ghost"
                    confirm="Mark this quotation as declined?"
                  />
                </>
              ) : null}
              {quotation.status !== "declined" ? (
                <ConvertQuotationButton quotationId={quotation.id} disabled={quotation.status === "expired"} />
              ) : null}
            </>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-5 py-4">
        <StatusBadge value={quotation.status} />
        <div className="h-4 w-px bg-border" />
        <p className="text-[13px] text-muted-foreground">{items.length} line items</p>
        <p className="ml-auto text-lg font-semibold tracking-tight">{formatCurrency(Number(quotation.total))}</p>
        {expired && isOpen ? (
          <StatusBadge value="expired" className="ml-2" />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Proposal</CardTitle>
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
                    <td className="px-5 py-3 text-right text-[12px] tabular-nums">{formatCurrency(Number(item.unit_price))}</td>
                    <td className="px-5 py-3 text-right text-[12px] font-medium tabular-nums">{formatCurrency(Number(item.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto w-full max-w-xs space-y-2 border-t p-5 text-[13px]">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums text-foreground">{formatCurrency(Number(quotation.subtotal))}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="tabular-nums text-foreground">−{formatCurrency(Number(quotation.discount_total))}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span className="tabular-nums text-foreground">{formatCurrency(Number(quotation.tax_total))}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(Number(quotation.total))}</span>
              </div>
            </div>
            {quotation.notes || quotation.terms ? (
              <div className="space-y-3 border-t px-5 py-4">
                {quotation.notes ? (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">{quotation.notes}</p>
                  </div>
                ) : null}
                {quotation.terms ? (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Terms</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">{quotation.terms}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prepared for</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-[12.5px]">
            <p className="text-base font-medium">{customer?.name}</p>
            {customer?.company ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="size-3.5" /> {customer.company}
              </p>
            ) : null}
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-3.5" /> {customer?.email}
            </p>
            {customer?.address ? <p className="text-muted-foreground">{customer.address}</p> : null}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={`/dashboard/customers/${customer?.id}`}>View customer</Link>
            </Button>
            <div className="border-t pt-3 text-[12px] text-muted-foreground">
              <p>Converting this quotation creates an open invoice with the same line items and totals.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
