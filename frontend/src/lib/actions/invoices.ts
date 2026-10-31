"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { invoiceSchema } from "@/lib/validations";
import type { ActionResult } from "@/types";

export async function createInvoice(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || !profile || profile.role === "customer") return { ok: false, error: "Staff access required" };

  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid invoice" };

  const { data: discount } = parsed.data.discount_id
    ? await supabase.from("discounts").select("type, value, is_active, valid_until").eq("id", parsed.data.discount_id).maybeSingle()
    : { data: null };
  const { data: tax } = parsed.data.tax_id
    ? await supabase.from("taxes").select("rate").eq("id", parsed.data.tax_id).maybeSingle()
    : { data: null };
  const { data: settings } = await supabase.from("app_settings").select("currency").eq("id", 1).maybeSingle();

  const items = parsed.data.items.map((item, index) => ({
    ...item,
    amount: Math.round(Number(item.quantity) * Number(item.unit_price) * 100) / 100,
    sort_order: index,
  }));
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  let discountTotal = 0;
  if (discount?.is_active && (!discount.valid_until || discount.valid_until >= parsed.data.issue_date)) {
    discountTotal =
      discount.type === "percentage"
        ? Math.round(subtotal * (Number(discount.value) / 100) * 100) / 100
        : Math.min(Number(discount.value), subtotal);
  }
  const taxTotal = Math.round((subtotal - discountTotal) * (Number(tax?.rate ?? 0) / 100) * 100) / 100;
  const total = Math.round((subtotal - discountTotal + taxTotal) * 100) / 100;

  const { data: numberData, error: numberError } = await supabase.rpc("next_document_number", {
    p_kind: "invoice",
  });
  if (numberError) return { ok: false, error: numberError.message };

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      number: numberData as string,
      customer_id: parsed.data.customer_id,
      subscription_id: parsed.data.subscription_id ?? null,
      status: "open",
      issue_date: parsed.data.issue_date,
      due_date: parsed.data.due_date,
      subtotal,
      discount_total: discountTotal,
      tax_total: taxTotal,
      total,
      currency: settings?.currency ?? "USD",
      notes: parsed.data.notes ?? null,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const { error: itemsError } = await supabase.from("invoice_items").insert(
    items.map((item) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      sort_order: item.sort_order,
    }))
  );
  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return { ok: false, error: itemsError.message };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Invoice created", id: invoice.id };
}

export async function saveInvoiceNotes(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || !profile || profile.role === "customer") return { ok: false, error: "Staff access required" };
  const id = formData.get("id") as string;
  const notes = formData.get("notes") as string;
  if (!id) return { ok: false, error: "Missing invoice" };
  const { error } = await supabase.from("invoices").update({ notes }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Notes saved" };
}
