"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { quotationSchema } from "@/lib/validations";
import { addInterval, formatDate } from "@/lib/utils";
import type { ActionResult } from "@/types";

export async function createQuotation(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || !profile || profile.role === "customer") return { ok: false, error: "Staff access required" };

  const parsed = quotationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid quotation" };

  const { data: discount } = parsed.data.discount_id
    ? await supabase.from("discounts").select("type, value, is_active").eq("id", parsed.data.discount_id).maybeSingle()
    : { data: null };
  const { data: tax } = parsed.data.tax_id
    ? await supabase.from("taxes").select("rate").eq("id", parsed.data.tax_id).maybeSingle()
    : { data: null };

  const items = parsed.data.items.map((item, index) => ({
    ...item,
    amount: Math.round(Number(item.quantity) * Number(item.unit_price) * 100) / 100,
    sort_order: index,
  }));
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  let discountTotal = 0;
  if (discount?.is_active) {
    discountTotal =
      discount.type === "percentage"
        ? Math.round(subtotal * (Number(discount.value) / 100) * 100) / 100
        : Math.min(Number(discount.value), subtotal);
  }
  const taxTotal = Math.round((subtotal - discountTotal) * (Number(tax?.rate ?? 0) / 100) * 100) / 100;
  const total = Math.round((subtotal - discountTotal + taxTotal) * 100) / 100;

  const { data: numberData, error: numberError } = await supabase.rpc("next_document_number", {
    p_kind: "quotation",
  });
  if (numberError) return { ok: false, error: numberError.message };

  const { data: quotation, error } = await supabase
    .from("quotations")
    .insert({
      number: numberData as string,
      customer_id: parsed.data.customer_id,
      issue_date: parsed.data.issue_date,
      valid_until: parsed.data.valid_until,
      subtotal,
      discount_total: discountTotal,
      tax_total: taxTotal,
      total,
      notes: parsed.data.notes ?? null,
      terms: parsed.data.terms ?? null,
      status: "draft",
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const { error: itemsError } = await supabase.from("quotation_items").insert(
    items.map((item) => ({
      quotation_id: quotation.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      sort_order: item.sort_order,
    }))
  );
  if (itemsError) {
    await supabase.from("quotations").delete().eq("id", quotation.id);
    return { ok: false, error: itemsError.message };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Quotation created", id: quotation.id };
}

export async function convertQuotationToInvoice(quotationId: string): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || !profile || profile.role === "customer") return { ok: false, error: "Staff access required" };

  const { data: quotation } = await supabase
    .from("quotations")
    .select("*, items:quotation_items(*)")
    .eq("id", quotationId)
    .maybeSingle();
  if (!quotation) return { ok: false, error: "Quotation not found" };
  if (quotation.status === "declined") return { ok: false, error: "Declined quotations cannot be invoiced" };

  const { data: existing } = await supabase
    .from("invoices")
    .select("id, number")
    .eq("customer_id", quotation.customer_id)
    .eq("total", quotation.total)
    .eq("issue_date", quotation.issue_date)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: `An invoice for this quotation already exists (${existing.number})` };
  }

  const { data: numberData, error: numberError } = await supabase.rpc("next_document_number", {
    p_kind: "invoice",
  });
  if (numberError) return { ok: false, error: numberError.message };

  const due = new Date();
  due.setDate(due.getDate() + 14);

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      number: numberData as string,
      customer_id: quotation.customer_id,
      status: "open",
      issue_date: formatDate(new Date(), "yyyy-MM-dd"),
      due_date: formatDate(due, "yyyy-MM-dd"),
      subtotal: quotation.subtotal,
      discount_total: quotation.discount_total,
      tax_total: quotation.tax_total,
      total: quotation.total,
      notes: quotation.notes,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const items = (quotation.items ?? []) as Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    sort_order: number;
  }>;

  if (items.length) {
    await supabase.from("invoice_items").insert(
      items.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        sort_order: item.sort_order,
      }))
    );
  }

  await supabase.from("quotations").update({ status: "accepted" }).eq("id", quotationId);
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Invoice created from quotation", id: invoice.id };
}

export async function convertQuotationToSubscription(
  quotationId: string,
  planId?: string
): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || !profile || profile.role === "customer") {
    return { ok: false, error: "Staff access required" };
  }

  const { data: quotation, error: quoteErr } = await supabase
    .from("quotations")
    .select("*, items:quotation_items(*)")
    .eq("id", quotationId)
    .single();

  if (quoteErr || !quotation) {
    return { ok: false, error: quoteErr?.message ?? "Quotation not found" };
  }
  if (quotation.status === "declined") {
    return { ok: false, error: "Declined quotations cannot be converted" };
  }

  // Find a target plan
  let targetPlanId = planId;
  if (!targetPlanId) {
    const { data: firstPlan } = await supabase
      .from("plans")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!firstPlan) {
      return { ok: false, error: "No active subscription plan found to attach to this subscription" };
    }
    targetPlanId = firstPlan.id;
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("id, interval, interval_count")
    .eq("id", targetPlanId)
    .single();

  if (!plan) return { ok: false, error: "Target plan not found" };

  const startDate = new Date();
  const periodEnd = addInterval(startDate, plan.interval, plan.interval_count);

  const { data: sub, error: subErr } = await supabase
    .from("subscriptions")
    .insert({
      customer_id: quotation.customer_id,
      plan_id: targetPlanId,
      status: "active",
      quantity: 1,
      started_at: formatDate(startDate, "yyyy-MM-dd"),
      current_period_start: formatDate(startDate, "yyyy-MM-dd"),
      current_period_end: formatDate(periodEnd, "yyyy-MM-dd"),
      discount_id: quotation.discount_id ?? null,
      tax_id: quotation.tax_id ?? null,
      notes: `Converted from quotation ${quotation.number}`,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (subErr || !sub) {
    return { ok: false, error: subErr?.message ?? "Could not create subscription" };
  }

  await supabase.from("quotations").update({ status: "accepted" }).eq("id", quotationId);

  revalidatePath("/dashboard", "layout");
  revalidatePath("/staff", "layout");
  return { ok: true, message: "Quotation converted to subscription", id: sub.id };
}
