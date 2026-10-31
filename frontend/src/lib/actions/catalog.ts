"use server";

import { revalidatePath } from "next/cache";
import { planSchema, productSchema } from "@/lib/validations";
import { api, BackendError } from "@/lib/api-client";
import type { ActionResult } from "@/types";

export async function saveProduct(formData: FormData): Promise<ActionResult> {
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid product" };

  const id = formData.get("id") as string | null;

  try {
    if (id) {
      const data = await api.put<{ id: string }>(`/products/${id}`, parsed.data);
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: "Product updated", id: data?.id ?? id };
    }

    const data = await api.post<{ id: string }>("/products", parsed.data);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Product created", id: data.id };
  } catch (e) {
    if (e instanceof BackendError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save product" };
  }
}

export async function savePlan(formData: FormData): Promise<ActionResult> {
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid plan" };

  const features = parsed.data.features
    ? parsed.data.features
        .split(/[,\n]/)
        .map((feature) => feature.trim())
        .filter(Boolean)
    : [];

  const payload = { ...parsed.data, features };

  const id = formData.get("id") as string | null;

  try {
    if (id) {
      const data = await api.put<{ id: string }>(`/plans/${id}`, payload);
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: "Plan updated", id: data?.id ?? id };
    }

    const data = await api.post<{ id: string }>("/plans", payload);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Plan created", id: data.id };
  } catch (e) {
    if (e instanceof BackendError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save plan" };
  }
}
