"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { invoiceSchema } from "@/lib/validations";
import { api, BackendError } from "@/lib/api-client";
import type { ActionResult } from "@/types";

export async function createInvoice(formData: FormData): Promise<ActionResult> {
  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid invoice" };

  const invoicePayload = {
    customer_id: parsed.data.customer_id,
    subscription_id: parsed.data.subscription_id ?? undefined,
    issue_date: parsed.data.issue_date,
    due_date: parsed.data.due_date,
    notes: parsed.data.notes ?? undefined,
    discount_id: parsed.data.discount_id ?? undefined,
    tax_id: parsed.data.tax_id ?? undefined,
    items: parsed.data.items.map((item, index) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      sort_order: index,
    })),
  };

  try {
    const invoice = await api.post<{ id: string }>("/invoices", invoicePayload);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Invoice created", id: invoice.id };
  } catch (e) {
    if (e instanceof BackendError) {
      return { ok: false, error: e.message };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create invoice",
    };
  }
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
