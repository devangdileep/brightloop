"use server";

import { revalidatePath } from "next/cache";
import { api, BackendError } from "@/lib/api-client";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { settingsSchema } from "@/lib/validations";
import type { ActionResult, UserRole } from "@/types";

export async function saveSettings(formData: FormData): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };

  try {
    await api.put<unknown>("/settings", parsed.data);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Workspace settings saved" };
  } catch (error) {
    if (error instanceof BackendError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Failed to save settings" };
  }
}

export async function updateMemberRole(userId: string, role: UserRole): Promise<ActionResult> {
  if (!["admin", "staff", "customer"].includes(role)) return { ok: false, error: "Invalid role" };

  try {
    await api.put<unknown>(`/profiles/${userId}/role?role=${encodeURIComponent(role)}`);
    revalidatePath("/dashboard/settings");
    return { ok: true, message: "Role updated" };
  } catch (error) {
    if (error instanceof BackendError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Failed to update role" };
  }
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
