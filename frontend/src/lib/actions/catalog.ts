"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { planSchema, productSchema } from "@/lib/validations";
import type { ActionResult } from "@/types";

export async function saveProduct(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || profile?.role !== "admin") return { ok: false, error: "Administrator access required" };

  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid product" };

  const id = formData.get("id") as string | null;
  if (id) {
    const { error } = await supabase.from("products").update(parsed.data).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Product updated", id };
  }
  const { data, error } = await supabase.from("products").insert(parsed.data).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Product created", id: data.id };
}

export async function savePlan(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || profile?.role !== "admin") return { ok: false, error: "Administrator access required" };

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
  if (id) {
    const { error } = await supabase.from("plans").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Plan updated", id };
  }
  const { data, error } = await supabase.from("plans").insert(payload).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Plan created", id: data.id };
}
