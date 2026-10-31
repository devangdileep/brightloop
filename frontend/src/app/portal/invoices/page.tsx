import { requireCustomer } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import {
  PortalInvoicesView,
  type PortalInvoiceItem,
} from "@/components/portal-invoices-view";

export default async function PortalInvoicesPage() {
  const { supabase, user } = await requireCustomer();

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  let invoices: PortalInvoiceItem[] = [];

  if (customer?.id) {
    const { data } = await supabase
      .from("invoices")
      .select("id, number, status, issue_date, due_date, subtotal, discount_total, tax_total, total, amount_paid, currency, notes, items:invoice_items(id, description, quantity, unit_price, amount)")
      .eq("customer_id", customer.id)
      .order("issue_date", { ascending: false });

    invoices = (data ?? []) as unknown as PortalInvoiceItem[];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Invoices"
        description="Access and download your billing statements and payment records."
      />
      <PortalInvoicesView invoices={invoices} />
    </div>
  );
}
