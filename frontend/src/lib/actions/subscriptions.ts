"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { subscriptionSchema } from "@/lib/validations";
import { addInterval, formatDate } from "@/lib/utils";
import type { ActionResult } from "@/types";

export async function createSubscription(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || !profile || profile.role === "customer") return { ok: false, error: "Staff access required" };

  const parsed = subscriptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid subscription" };

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, interval, interval_count, trial_days")
    .eq("id", parsed.data.plan_id)
    .maybeSingle();
  if (planError || !plan) return { ok: false, error: "Plan not found" };

  const start = new Date(`${parsed.data.started_at}T00:00:00`);
  const trialDays = Number(plan.trial_days ?? 0);
  const trialEnd = trialDays > 0 ? new Date(start.getTime() + trialDays * 86400000) : null;

  let periodStart = start;
  let periodEnd = addInterval(start, plan.interval, plan.interval_count ?? 1);
  if (parsed.data.status === "trialing" && trialEnd) {
    periodStart = trialEnd;
    periodEnd = addInterval(trialEnd, plan.interval, plan.interval_count ?? 1);
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      customer_id: parsed.data.customer_id,
      plan_id: parsed.data.plan_id,
      status: parsed.data.status,
      quantity: parsed.data.quantity,
      started_at: parsed.data.started_at,
      current_period_start: formatDate(periodStart, "yyyy-MM-dd"),
      current_period_end: formatDate(periodEnd, "yyyy-MM-dd"),
      trial_end: trialEnd ? formatDate(trialEnd, "yyyy-MM-dd") : null,
      discount_id: parsed.data.discount_id ?? null,
      tax_id: parsed.data.tax_id ?? null,
      notes: parsed.data.notes ?? null,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Subscription created", id: data.id };
}
