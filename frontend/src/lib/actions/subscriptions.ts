"use server";

import { revalidatePath } from "next/cache";
import { subscriptionSchema } from "@/lib/validations";
import { api, BackendError } from "@/lib/api-client";
import type { ActionResult } from "@/types";

export async function createSubscription(formData: FormData): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid subscription" };

  const subscriptionPayload = {
    customer_id: parsed.data.customer_id,
    plan_id: parsed.data.plan_id,
    status: parsed.data.status,
    quantity: parsed.data.quantity,
    started_at: parsed.data.started_at,
    discount_id: parsed.data.discount_id ?? undefined,
    tax_id: parsed.data.tax_id ?? undefined,
    notes: parsed.data.notes ?? undefined,
  };

  try {
    const data = await api.post<{ id: string }>("/subscriptions", subscriptionPayload);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Subscription created", id: data.id };
  } catch (e) {
    if (e instanceof BackendError) {
      return { ok: false, error: e.message };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create subscription",
    };
  }
}
