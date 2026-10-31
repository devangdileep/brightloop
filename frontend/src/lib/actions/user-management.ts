"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity-logger";
import { createStaffSchema, editStaffSchema } from "@/lib/validations";
import type { ActionResult, ActivityLog } from "@/types";

export async function createStaffAccount(formData: FormData): Promise<ActionResult> {
  const { profile, user, supabase } = await requireAdmin();

  const parsed = createStaffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid staff details" };
  }

  const { full_name, email, phone, department, designation } = parsed.data;

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return {
      ok: false,
      error: "Staff account creation requires SUPABASE_SERVICE_ROLE_KEY configured on the server.",
    };
  }

  // Check if profile or auth user exists
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id, email, role")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (existingProfile) {
    if (existingProfile.role === "admin" || existingProfile.role === "staff") {
      return { ok: false, error: `A team member account already exists for ${email}` };
    }
  }

  // Invite staff member via Supabase Auth Admin API
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data: authData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email.toLowerCase(),
    {
      data: { full_name, phone },
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    }
  );

  if (inviteError || !authData.user) {
    return { ok: false, error: inviteError?.message ?? "Could not create staff user" };
  }

  const staffUserId = authData.user.id;

  // Ensure profile has staff role and active status
  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert({
      id: staffUserId,
      email: email.toLowerCase(),
      full_name,
      phone: phone ?? null,
      role: "staff",
      status: "active",
      updated_at: new Date().toISOString(),
    });

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  // Create staff_details record
  const { error: detailError } = await adminClient
    .from("staff_details")
    .upsert({
      user_id: staffUserId,
      department,
      designation,
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (detailError) {
    console.error("Could not write staff details:", detailError);
  }

  // Log activity
  await logActivity(supabase, {
    userId: user.id,
    action: "staff.created",
    entityType: "staff",
    entityId: staffUserId,
    description: `Admin ${profile.full_name || profile.email} created staff account for ${full_name} (${email})`,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
  return { ok: true, message: `Staff account created and invitation sent to ${email}`, id: staffUserId };
}

export async function updateStaffProfile(userId: string, formData: FormData): Promise<ActionResult> {
  const { profile, user, supabase } = await requireAdmin();

  const parsed = editStaffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid staff information" };
  }

  const { full_name, phone, department, designation, status } = parsed.data;

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return { ok: false, error: "Server service role not configured" };
  }

  // Update profile
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({
      full_name,
      phone: phone ?? null,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileError) return { ok: false, error: profileError.message };

  // Update staff_details
  const { error: detailError } = await adminClient
    .from("staff_details")
    .upsert({
      user_id: userId,
      department: department ?? null,
      designation: designation ?? null,
      updated_at: new Date().toISOString(),
    });

  if (detailError) return { ok: false, error: detailError.message };

  await logActivity(supabase, {
    userId: user.id,
    action: "staff.updated",
    entityType: "staff",
    entityId: userId,
    description: `Admin ${profile.full_name || profile.email} updated staff member ${full_name}`,
  });

  revalidatePath("/admin/users");
  return { ok: true, message: "Staff information updated" };
}

export async function toggleStaffStatus(userId: string, targetStatus: "active" | "inactive"): Promise<ActionResult> {
  const { profile, user, supabase } = await requireAdmin();
  if (user.id === userId) {
    return { ok: false, error: "You cannot deactivate your own account" };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return { ok: false, error: "Server service role not configured" };
  }

  const { error } = await adminClient
    .from("profiles")
    .update({ status: targetStatus, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, {
    userId: user.id,
    action: targetStatus === "active" ? "staff.activated" : "staff.deactivated",
    entityType: "staff",
    entityId: userId,
    description: `Admin ${profile.full_name || profile.email} marked staff member ${targetStatus}`,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
  return { ok: true, message: `Staff account marked as ${targetStatus}` };
}

export async function toggleCustomerAccountStatus(
  customerId: string,
  targetStatus: "active" | "inactive"
): Promise<ActionResult> {
  const { profile, user, supabase } = await requireStaff();

  const { data: customer, error: fetchErr } = await supabase
    .from("customers")
    .select("id, name, user_id, status")
    .eq("id", customerId)
    .single();

  if (fetchErr || !customer) return { ok: false, error: "Customer not found" };

  const { error: custErr } = await supabase
    .from("customers")
    .update({
      status: targetStatus,
      customer_status: targetStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);

  if (custErr) return { ok: false, error: custErr.message };

  // If customer has a linked profile, update profile status
  if (customer.user_id) {
    try {
      const adminClient = createAdminClient();
      await adminClient
        .from("profiles")
        .update({ status: targetStatus, updated_at: new Date().toISOString() })
        .eq("id", customer.user_id);
    } catch {
      // Continue even if service role not available
    }
  }

  await logActivity(supabase, {
    userId: user.id,
    action: targetStatus === "active" ? "customer.activated" : "customer.deactivated",
    entityType: "customer",
    entityId: customerId,
    description: `${profile.role} ${profile.full_name || profile.email} marked customer ${customer.name} as ${targetStatus}`,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/customers");
  revalidatePath("/staff/customers");
  revalidatePath("/dashboard/customers");
  return { ok: true, message: `Customer marked as ${targetStatus}` };
}

export async function fetchActivityLogs(limit = 20): Promise<ActivityLog[]> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("activity_logs")
    .select("id, user_id, action, entity_type, entity_id, description, created_at, user:profiles(id, full_name, email)")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as unknown as ActivityLog[];
}
