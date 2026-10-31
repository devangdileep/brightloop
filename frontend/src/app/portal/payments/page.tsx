import { requireCustomer } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Wallet } from "lucide-react";

export default async function PortalPaymentsPage() {
  const { supabase, user } = await requireCustomer();

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  let payments: Array<{
    id: string;
    amount: number;
    method: string;
    reference: string | null;
    paid_at: string;
    invoice: { number: string } | null;
  }> = [];

  if (customer?.id) {
    const { data } = await supabase
      .from("payments")
      .select("id, amount, method, reference, paid_at, invoice:invoices(number)")
      .eq("customer_id", customer.id)
      .order("paid_at", { ascending: false });

    payments = (data ?? []) as unknown as typeof payments;
  }

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment History"
        description="Review all confirmed payments and transaction receipts."
      />

      <div className="rounded-xl border bg-card p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Paid to Date</p>
          <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Wallet className="size-5" />
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/40 uppercase tracking-wider text-[10px] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Date Paid</th>
                <th className="px-4 py-3 font-semibold">Invoice Number</th>
                <th className="px-4 py-3 font-semibold">Payment Method</th>
                <th className="px-4 py-3 font-semibold">Reference</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No payments have been recorded for your account yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{formatDate(p.paid_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.invoice?.number ?? "General Payment"}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{p.method.replace("_", " ")}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{p.reference || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-600">
                      +{formatCurrency(Number(p.amount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
