"use server";

import { revalidatePath } from "next/cache";
import { requireCustomer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { addInterval, formatDate } from "@/lib/utils";
import { createInvoiceForSubscription } from "@/lib/billing";
import { logActivity } from "@/lib/activity-logger";
import { customerProfileSchema, customerSelfSubscribeSchema } from "@/lib/validations";
import type { ActionResult } from "@/types";

export async function cancelMySubscription(subscriptionId: string): Promise<ActionResult> {
  const { supabase, profile, user } = await requireCustomer();

  const { error } = await supabase.rpc("customer_cancel_subscription", { p_subscription_id: subscriptionId });
  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, {
    userId: user.id,
    action: "subscription.cancel_requested",
    entityType: "subscription",
    entityId: subscriptionId,
    description: `Customer ${profile.full_name || profile.email} scheduled cancellation at period end`,
  });

  revalidatePath("/portal", "layout");
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Your subscription will cancel at the end of the billing period" };
}

export async function resumeMySubscription(subscriptionId: string): Promise<ActionResult> {
  const { supabase, profile, user } = await requireCustomer();

  const { error } = await supabase.rpc("customer_resume_subscription", { p_subscription_id: subscriptionId });
  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, {
    userId: user.id,
    action: "subscription.resumed",
    entityType: "subscription",
    entityId: subscriptionId,
    description: `Customer ${profile.full_name || profile.email} reversed subscription cancellation`,
  });

  revalidatePath("/portal", "layout");
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Cancellation reversed — your subscription stays active" };
}

export async function pauseMySubscription(subscriptionId: string): Promise<ActionResult> {
  const { supabase, profile, user } = await requireCustomer();

  // Verify ownership
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!customer) return { ok: false, error: "Customer profile not linked" };

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "paused" })
    .eq("id", subscriptionId)
    .eq("customer_id", customer.id)
    .in("status", ["active", "trialing"]);

  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, {
    userId: user.id,
    action: "subscription.paused",
    entityType: "subscription",
    entityId: subscriptionId,
    description: `Customer ${profile.full_name || profile.email} paused subscription`,
  });

  revalidatePath("/portal", "layout");
  return { ok: true, message: "Subscription paused" };
}

export async function customerSubscribe(planId: string, quantity = 1): Promise<ActionResult> {
  const { supabase, profile, user } = await requireCustomer();

  const parsed = customerSelfSubscribeSchema.safeParse({ plan_id: planId, quantity });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid subscription" };

  // Get active plan
  const { data: plan, error: planErr } = await supabase
    .from("plans")
    .select("id, name, price, interval, interval_count, is_active")
    .eq("id", planId)
    .single();

  if (planErr || !plan || !plan.is_active) {
    return { ok: false, error: "The selected plan is not currently available" };
  }

  // Find or create customer record for this user
  let customerId: string | null = null;
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingCustomer) {
    customerId = existingCustomer.id;
  } else {
    // Create new customer
    const { data: newCustomer, error: createCustErr } = await supabase
      .from("customers")
      .insert({
        user_id: user.id,
        name: profile.full_name || profile.email.split("@")[0],
        email: profile.email,
        phone: profile.phone,
        status: "active",
        customer_status: "active",
      })
      .select("id")
      .single();

    if (createCustErr || !newCustomer) {
      return { ok: false, error: createCustErr?.message ?? "Could not initialize customer record" };
    }
    customerId = newCustomer.id;
  }

  const startDate = new Date();
  const periodEnd = addInterval(startDate, plan.interval, plan.interval_count);

  // Insert subscription
  const { data: subscription, error: subErr } = await supabase
    .from("subscriptions")
    .insert({
      customer_id: customerId,
      plan_id: plan.id,
      quantity,
      status: "active",
      started_at: formatDate(startDate, "yyyy-MM-dd"),
      current_period_start: formatDate(startDate, "yyyy-MM-dd"),
      current_period_end: formatDate(periodEnd, "yyyy-MM-dd"),
      cancel_at_period_end: false,
    })
    .select("id")
    .single();

  if (subErr || !subscription) {
    return { ok: false, error: subErr?.message ?? "Could not create subscription" };
  }

  // Generate initial invoice
  try {
    const admin = createAdminClient();
    await createInvoiceForSubscription(admin, subscription.id, {
      createdBy: profile.id,
      advancePeriod: false,
    });
  } catch (invErr) {
    console.error("Initial invoice generation notice:", invErr);
  }

  await logActivity(supabase, {
    userId: user.id,
    action: "customer.subscribed",
    entityType: "subscription",
    entityId: subscription.id,
    description: `Customer ${profile.full_name || profile.email} subscribed to ${plan.name} (qty: ${quantity})`,
  });

  revalidatePath("/portal", "layout");
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: `Successfully subscribed to ${plan.name}`, id: subscription.id };
}

export async function updateCustomerProfile(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireCustomer();

  const parsed = customerProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { full_name, phone, company_name, billing_address } = parsed.data;

  // Update profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name, phone: phone ?? null, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (profileError) return { ok: false, error: profileError.message };

  // Update customer
  const { error: customerError } = await supabase
    .from("customers")
    .update({
      name: full_name,
      phone: phone ?? null,
      company: company_name ?? null,
      company_name: company_name ?? null,
      address: billing_address ?? null,
      billing_address: billing_address ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (customerError) return { ok: false, error: customerError.message };

  await logActivity(supabase, {
    userId: user.id,
    action: "customer.profile_updated",
    entityType: "profile",
    entityId: user.id,
    description: `Customer ${full_name} updated billing profile`,
  });

  revalidatePath("/portal/profile");
  revalidatePath("/portal/dashboard");
  return { ok: true, message: "Profile updated successfully" };
}
