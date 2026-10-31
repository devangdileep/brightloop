"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { customerSchema } from "@/lib/validations";
import type { ActionResult } from "@/types";

export async function saveCustomer(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || !profile || profile.role === "customer") return { ok: false, error: "Staff access required" };

  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid customer" };

  const id = formData.get("id") as string | null;
  if (id) {
    const { error } = await supabase.from("customers").update(parsed.data).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Customer updated", id };
  }

  const { data, error } = await supabase.from("customers").insert(parsed.data).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Customer created", id: data.id };
}

export async function inviteCustomerPortal(customerId: string): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || !profile || profile.role === "customer") return { ok: false, error: "Staff access required" };

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, email, user_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return { ok: false, error: "Customer not found" };
  if (customer.user_id) return { ok: false, error: "This customer already has portal access" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      error: "Portal invitations require SUPABASE_SERVICE_ROLE_KEY on the server.",
    };
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(customer.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=/dashboard/portal`,
    data: { full_name: customer.name, customer_id: customer.id },
  });
  if (error) return { ok: false, error: error.message };

  if (data.user) {
    await admin.from("customers").update({ user_id: data.user.id }).eq("id", customer.id);
    await admin.from("profiles").update({ role: "customer" }).eq("id", data.user.id);
  }

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { ok: true, message: `Portal invitation sent to ${customer.email}` };
}
