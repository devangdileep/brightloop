import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createQuotation } from "@/lib/actions/quotations";
import { PageHeader } from "@/components/page-header";
import { LineItemsForm } from "@/components/line-items-form";
import { Button } from "@/components/ui/button";

export default async function NewQuotationPage() {
  const { supabase } = await requireStaff();

  const [customersRes, taxesRes, discountsRes, plansRes, settingsRes] = await Promise.all([
    supabase.from("customers").select("id, name, email").eq("status", "active").order("name"),
    supabase.from("taxes").select("id, name, rate").eq("is_active", true).order("name"),
    supabase.from("discounts").select("id, code, type, value").eq("is_active", true).order("code"),
    supabase.from("plans").select("id, name, price").eq("is_active", true).order("price"),
    supabase.from("app_settings").select("default_tax_id, currency").eq("id", 1).maybeSingle(),
  ]);

  const customers = ((customersRes.data ?? []) as unknown as Array<{ id: string; name: string; email: string }>).map((customer) => ({
    value: customer.id,
    label: `${customer.name} · ${customer.email}`,
  }));
  const taxes = ((taxesRes.data ?? []) as unknown as Array<{ id: string; name: string; rate: number }>).map((tax) => ({
    value: tax.id,
    label: `${tax.name} (${tax.rate}%)`,
    rate: Number(tax.rate),
  }));
  const discounts = ((discountsRes.data ?? []) as unknown as Array<{ id: string; code: string; type: string; value: number }>).map(
    (discount) => ({
      value: discount.id,
      label: `${discount.code} · ${discount.type === "percentage" ? `${discount.value}%` : `$${discount.value}`} off`,
      type: discount.type,
      amount: Number(discount.value),
    })
  );
  const plans = ((plansRes.data ?? []) as unknown as Array<{ id: string; name: string; price: number }>).map((plan) => ({
    value: plan.id,
    label: plan.name,
    price: Number(plan.price),
  }));

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
        <Link href="/dashboard/quotations">
          <ArrowLeft className="size-3.5" /> Quotations
        </Link>
      </Button>
      <PageHeader
        title="New quotation"
        description="Add line items, apply an optional discount and tax rate, then send it to your customer."
      />
      <LineItemsForm
        mode="quotation"
        action={createQuotation}
        customers={customers}
        taxes={taxes}
        discounts={discounts}
        plans={plans}
        defaultTaxId={settingsRes.data?.default_tax_id ?? undefined}
        currency={settingsRes.data?.currency ?? "USD"}
      />
    </div>
  );
}
