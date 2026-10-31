"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { settingsSchema } from "@/lib/validations";
import type { ActionResult, UserRole } from "@/types";

export async function saveSettings(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || profile?.role !== "admin") return { ok: false, error: "Administrator access required" };

  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };

  const { error } = await supabase.from("app_settings").update(parsed.data).eq("id", 1);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Workspace settings saved" };
}

export async function updateMemberRole(userId: string, role: UserRole): Promise<ActionResult> {
  const { supabase, profile, user } = await getSessionProfile();
  if (!supabase || profile?.role !== "admin") return { ok: false, error: "Administrator access required" };
  if (user?.id === userId) return { ok: false, error: "You cannot change your own role" };
  if (!["admin", "staff", "customer"].includes(role)) return { ok: false, error: "Invalid role" };

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Role updated" };
}

export async function inviteTeamMember(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || profile?.role !== "admin") return { ok: false, error: "Administrator access required" };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "staff") as UserRole;
  if (!email.includes("@")) return { ok: false, error: "Enter a valid email address" };
  if (!["staff", "admin"].includes(role)) return { ok: false, error: "Invite staff or admin only" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Team invitations require SUPABASE_SERVICE_ROLE_KEY on the server." };
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=/reset-password`,
    data: { full_name: email.split("@")[0] },
  });
  if (error) return { ok: false, error: error.message };

  if (data.user) {
    await admin.from("profiles").update({ role }).eq("id", data.user.id);
  }

  revalidatePath("/dashboard/settings");
  return { ok: true, message: `Invitation sent to ${email}` };
}
