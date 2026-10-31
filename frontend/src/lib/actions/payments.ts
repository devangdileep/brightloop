"use server";

import { revalidatePath } from "next/cache";
import { paymentSchema } from "@/lib/validations";
import { api, BackendError } from "@/lib/api-client";
import type { ActionResult } from "@/types";

export async function recordPayment(formData: FormData): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment" };

  const paymentPayload = {
    invoice_id: parsed.data.invoice_id,
    amount: parsed.data.amount,
    method: parsed.data.method,
    reference: parsed.data.reference ?? undefined,
    paid_at: new Date(parsed.data.paid_at).toISOString(),
    notes: parsed.data.notes ?? undefined,
  };

  try {
    const res = await api.post<{ payment: { id: string } }>("/payments", paymentPayload);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Payment recorded", id: res.payment.id };
  } catch (e) {
    if (e instanceof BackendError) {
      return { ok: false, error: e.message };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to record payment",
    };
  }
}
