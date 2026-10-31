"use server";

import { revalidatePath } from "next/cache";
import { api, BackendError } from "@/lib/api-client";
import { getSessionProfile } from "@/lib/auth";
import { quotationSchema } from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import type { ActionResult } from "@/types";

export async function createQuotation(formData: FormData): Promise<ActionResult> {
  const parsed = quotationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid quotation" };

  const quotationPayload = {
    customer_id: parsed.data.customer_id,
    issue_date: parsed.data.issue_date,
    valid_until: parsed.data.valid_until,
    notes: parsed.data.notes ?? null,
    terms: parsed.data.terms ?? null,
    discount_id: parsed.data.discount_id ?? null,
    tax_id: parsed.data.tax_id ?? null,
    items: parsed.data.items.map((item, index) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      sort_order: index,
    })),
  };

  try {
    const res = await api.post<{ id: string }>("/quotations", quotationPayload);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Quotation created", id: res.id };
  } catch (error) {
    if (error instanceof BackendError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Failed to create quotation" };
  }
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
  // Find a target plan
  let targetPlanId = planId;
  if (!targetPlanId) {
    try {
      const plansRes = await api.get<{ items: Array<{ id: string }> }>("/plans", {
        is_active: "true",
        limit: "1",
      });
      if (!plansRes.items || plansRes.items.length === 0) {
        return { ok: false, error: "No active subscription plan found to attach to this subscription" };
      }
      targetPlanId = plansRes.items[0].id;
    } catch (error) {
      if (error instanceof BackendError) {
        return { ok: false, error: error.message };
      }
      return { ok: false, error: "Failed to find active plan" };
    }
  }

  try {
    const res = await api.post<{
      ok?: boolean;
      message?: string;
      quotation_id?: string;
      subscription?: { id: string };
      subscription_id?: string;
    }>(`/quotations/${quotationId}/convert?plan_id=${encodeURIComponent(targetPlanId)}`);

    revalidatePath("/dashboard", "layout");
    revalidatePath("/staff", "layout");
    return {
      ok: true,
      message: "Quotation converted to subscription",
      id: res.subscription?.id ?? res.subscription_id,
    };
  } catch (error) {
    if (error instanceof BackendError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not convert quotation to subscription",
    };
  }
}
