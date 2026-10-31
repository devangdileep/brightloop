"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { paymentSchema } from "@/lib/validations";
import type { ActionResult } from "@/types";

export async function recordPayment(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || !profile || profile.role === "customer") return { ok: false, error: "Staff access required" };

  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment" };

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, customer_id, total, amount_paid, status")
    .eq("id", parsed.data.invoice_id)
    .maybeSingle();
  if (invoiceError || !invoice) return { ok: false, error: "Invoice not found" };
  if (invoice.status === "void") return { ok: false, error: "Void invoices cannot receive payments" };

  const balance = Math.round((Number(invoice.total) - Number(invoice.amount_paid)) * 100) / 100;
  if (parsed.data.amount > balance + 0.001) {
    return { ok: false, error: `Amount exceeds the open balance of $${balance.toFixed(2)}` };
  }

  const { data, error } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoice.id,
      customer_id: invoice.customer_id,
      amount: parsed.data.amount,
      method: parsed.data.method,
      reference: parsed.data.reference ?? null,
      paid_at: new Date(parsed.data.paid_at).toISOString(),
      notes: parsed.data.notes ?? null,
      recorded_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Payment recorded", id: data.id };
}
