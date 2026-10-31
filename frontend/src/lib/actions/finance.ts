"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { discountSchema, taxSchema } from "@/lib/validations";
import type { ActionResult } from "@/types";

export async function saveDiscount(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || profile?.role !== "admin") return { ok: false, error: "Administrator access required" };

  const parsed = discountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid discount" };

  const id = formData.get("id") as string | null;
  if (id) {
    const { error } = await supabase.from("discounts").update(parsed.data).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Discount updated", id };
  }
  const { data, error } = await supabase.from("discounts").insert(parsed.data).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Discount created", id: data.id };
}

export async function saveTax(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || profile?.role !== "admin") return { ok: false, error: "Administrator access required" };

  const parsed = taxSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid tax" };

  const id = formData.get("id") as string | null;
  if (parsed.data.is_default) {
    await supabase.from("taxes").update({ is_default: false }).neq("id", id ?? "00000000-0000-0000-0000-000000000000");
  }

  if (id) {
    const { error } = await supabase.from("taxes").update(parsed.data).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Tax rate updated", id };
  }
  const { data, error } = await supabase.from("taxes").insert(parsed.data).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Tax rate created", id: data.id };
}
