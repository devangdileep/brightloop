"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import type { ActionResult } from "@/types";

export async function cancelMySubscription(subscriptionId: string): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || !profile) return { ok: false, error: "Not authenticated" };
  const { error } = await supabase.rpc("customer_cancel_subscription", { p_subscription_id: subscriptionId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Your subscription will cancel at the end of the billing period" };
}

export async function resumeMySubscription(subscriptionId: string): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || !profile) return { ok: false, error: "Not authenticated" };
  const { error } = await supabase.rpc("customer_resume_subscription", { p_subscription_id: subscriptionId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Cancellation reversed — your subscription stays active" };
}
