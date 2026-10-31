"use server";

import { revalidatePath } from "next/cache";
import { discountSchema, taxSchema } from "@/lib/validations";
import { api, BackendError } from "@/lib/api-client";
import type { ActionResult } from "@/types";

export async function saveDiscount(formData: FormData): Promise<ActionResult> {
  const parsed = discountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid discount" };

  const id = formData.get("id") as string | null;

  try {
    if (id) {
      const data = await api.put<{ id: string }>(`/discounts/${id}`, parsed.data);
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: "Discount updated", id: data?.id ?? id };
    }

    const data = await api.post<{ id: string }>("/discounts", parsed.data);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Discount created", id: data.id };
  } catch (e) {
    if (e instanceof BackendError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save discount" };
  }
}

export async function saveTax(formData: FormData): Promise<ActionResult> {
  const parsed = taxSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid tax" };

  const id = formData.get("id") as string | null;

  try {
    if (id) {
      const data = await api.put<{ id: string }>(`/taxes/${id}`, parsed.data);
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: "Tax rate updated", id: data?.id ?? id };
    }

    const data = await api.post<{ id: string }>("/taxes", parsed.data);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Tax rate created", id: data.id };
  } catch (e) {
    if (e instanceof BackendError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save tax rate" };
  }
}
