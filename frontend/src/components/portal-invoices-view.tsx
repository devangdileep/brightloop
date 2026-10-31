"use client";

import * as React from "react";
import { Download, Eye, Printer, Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface PortalInvoiceItem {
  id: string;
  number: string;
  status: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  currency: string;
  notes: string | null;
  items?: {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }[];
}

export function PortalInvoicesView({ invoices }: { invoices: PortalInvoiceItem[] }) {
  const [selectedInvoice, setSelectedInvoice] = React.useState<PortalInvoiceItem | null>(null);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/40 uppercase tracking-wider text-[10px] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Invoice Number</th>
                <th className="px-4 py-3 font-semibold">Invoice Date</th>
                <th className="px-4 py-3 font-semibold">Due Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Total Amount</th>
                <th className="px-4 py-3 text-right font-semibold">Amount Paid</th>
                <th className="px-4 py-3 text-right font-semibold">Balance Due</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No invoices have been generated for your account yet.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const balance = Math.max(0, Number(inv.total) - Number(inv.amount_paid));
                  return (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{inv.number}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.issue_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.due_date)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={inv.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatCurrency(Number(inv.total), inv.currency)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                        {formatCurrency(Number(inv.amount_paid), inv.currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        <span className={balance > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                          {formatCurrency(balance, inv.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setSelectedInvoice(inv)}
                          title="View details"
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        <Button asChild variant="ghost" size="icon-sm" title="Download PDF">
                          <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">
                            <Download className="size-3.5" />
                          </a>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Details Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="size-5 text-primary" />
              Invoice {selectedInvoice?.number}
            </DialogTitle>
            <DialogDescription>
              Issued on {selectedInvoice ? formatDate(selectedInvoice.issue_date) : ""} · Due {selectedInvoice ? formatDate(selectedInvoice.due_date) : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice ? (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/20 p-3">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Total</p>
                  <p className="text-sm font-bold mt-0.5">{formatCurrency(Number(selectedInvoice.total), selectedInvoice.currency)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Paid</p>
                  <p className="text-sm font-semibold mt-0.5 text-emerald-600">{formatCurrency(Number(selectedInvoice.amount_paid), selectedInvoice.currency)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Status</p>
                  <div className="mt-1"><StatusBadge value={selectedInvoice.status} /></div>
                </div>
              </div>

              {selectedInvoice.items?.length ? (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b bg-muted/40 uppercase tracking-wider text-[10px] text-muted-foreground">
                      <tr>
                        <th className="p-2.5">Item</th>
                        <th className="p-2.5 text-right">Qty</th>
                        <th className="p-2.5 text-right">Price</th>
                        <th className="p-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedInvoice.items.map((item) => (
                        <tr key={item.id}>
                          <td className="p-2.5">{item.description}</td>
                          <td className="p-2.5 text-right tabular-nums">{item.quantity}</td>
                          <td className="p-2.5 text-right tabular-nums">{formatCurrency(Number(item.unit_price))}</td>
                          <td className="p-2.5 text-right font-medium tabular-nums">{formatCurrency(Number(item.amount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="space-y-1 text-right text-xs pt-1">
                <p className="text-muted-foreground">Subtotal: {formatCurrency(Number(selectedInvoice.subtotal), selectedInvoice.currency)}</p>
                {Number(selectedInvoice.discount_total) > 0 ? (
                  <p className="text-emerald-600">Discount: −{formatCurrency(Number(selectedInvoice.discount_total), selectedInvoice.currency)}</p>
                ) : null}
                {Number(selectedInvoice.tax_total) > 0 ? (
                  <p className="text-muted-foreground">Tax: {formatCurrency(Number(selectedInvoice.tax_total), selectedInvoice.currency)}</p>
                ) : null}
                <p className="text-sm font-bold text-foreground">
                  Balance Due: {formatCurrency(Math.max(0, Number(selectedInvoice.total) - Number(selectedInvoice.amount_paid)), selectedInvoice.currency)}
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <div className="flex items-center gap-1.5">
              {selectedInvoice ? (
                <>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/invoices/${selectedInvoice.id}/pdf`} target="_blank" rel="noreferrer">
                      <Download className="size-3.5 mr-1.5" /> Download PDF
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.print()}>
                    <Printer className="size-3.5 mr-1.5" /> Print
                  </Button>
                </>
              ) : null}
            </div>
            <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
