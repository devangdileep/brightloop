"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validations";
import type { ActionResult } from "@/types";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    // The backend doesn't have a self-update profile endpoint,
    // so we keep using the Supabase client directly for this.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: parsed.data.full_name, phone: parsed.data.phone })
      .eq("id", user.id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard/settings");
    return { ok: true, message: "Profile updated" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update profile" };
  }
}
