// Supabase Edge Function: generate-invoices
// Deploy: supabase functions deploy generate-invoices --no-verify-jwt
// Schedule with supabase/cron.sql (Supabase Cron / pg_cron + pg_net).
//
// The service-role key is provided automatically to deployed functions.
// We additionally accept a BILLING_CRON_SECRET bearer token for scheduled calls.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type SubscriptionRow = {
  id: string;
  customer_id: string;
  quantity: number;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  discount_id: string | null;
  plan: { name: string; price: number; interval: string; interval_count: number } | null;
  discount: { type: string; value: number; is_active: boolean; valid_until: string | null } | null;
  tax: { rate: number } | null;
};

function addInterval(dateText: string, interval: string, count: number) {
  const date = new Date(`${dateText}T00:00:00Z`);
  if (interval === "monthly") date.setUTCMonth(date.getUTCMonth() + count);
  else if (interval === "quarterly") date.setUTCMonth(date.getUTCMonth() + 3 * count);
  else date.setUTCFullYear(date.getUTCFullYear() + count);
  return date.toISOString().slice(0, 10);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST" && request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const secret = Deno.env.get("BILLING_CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceKey) return json({ error: "Service role key missing" }, 500);
  if (secret && token !== secret && token !== serviceKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { persistSession: false },
  });

  const today = new Date().toISOString().slice(0, 10);
  const { data: due, error: dueError } = await supabase
    .from("subscriptions")
    .select(
      "id, customer_id, quantity, status, current_period_start, current_period_end, cancel_at_period_end, discount_id, plan:plans(name,price,interval,interval_count), discount:discounts(type,value,is_active,valid_until), tax:taxes(rate)"
    )
    .in("status", ["active", "past_due", "trialing"])
    .lte("current_period_end", today);

  if (dueError) return json({ error: dueError.message }, 500);

  const { data: settings } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  const dueDays = Number(settings?.invoice_due_days ?? 14);
  const currency = settings?.currency ?? "USD";
  const result = { created: 0, skipped: 0, failed: 0, invoices: [] as string[], errors: [] as string[] };

  for (const subscription of (due ?? []) as SubscriptionRow[]) {
    try {
      const plan = subscription.plan;
      if (!plan) throw new Error("Missing plan");

      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("subscription_id", subscription.id)
        .eq("period_start", subscription.current_period_start)
        .maybeSingle();

      if (existing) {
        result.skipped += 1;
        continue;
      }

      const quantity = Number(subscription.quantity ?? 1);
      const subtotal = Math.round(Number(plan.price) * quantity * 100) / 100;
      const discount = subscription.discount;
      const discountValid =
        discount &&
        discount.is_active &&
        (!discount.valid_until || discount.valid_until >= today);
      const discountTotal = discountValid
        ? discount.type === "percentage"
          ? Math.round(subtotal * (Number(discount.value) / 100) * 100) / 100
          : Math.min(Number(discount.value), subtotal)
        : 0;
      const taxTotal = Math.round((subtotal - discountTotal) * (Number(subscription.tax?.rate ?? 0) / 100) * 100) / 100;
      const total = Math.round((subtotal - discountTotal + taxTotal) * 100) / 100;

      const { data: numberData, error: numberError } = await supabase.rpc("next_document_number", {
        p_kind: "invoice",
      });
      if (numberError) throw numberError;

      const issueDate = new Date();
      const dueDate = new Date(issueDate.getTime() + dueDays * 86400000);

      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          number: numberData,
          customer_id: subscription.customer_id,
          subscription_id: subscription.id,
          status: "open",
          issue_date: issueDate.toISOString().slice(0, 10),
          due_date: dueDate.toISOString().slice(0, 10),
          period_start: subscription.current_period_start,
          period_end: subscription.current_period_end,
          subtotal,
          discount_total: discountTotal,
          tax_total: taxTotal,
          total,
          currency,
        })
        .select("id, number")
        .single();
      if (invoiceError) throw invoiceError;

      await supabase.from("invoice_items").insert({
        invoice_id: invoice.id,
        description: `${plan.name} subscription — ${quantity} seat${quantity === 1 ? "" : "s"}`,
        quantity,
        unit_price: plan.price,
        amount: subtotal,
        sort_order: 0,
      });

      const nextStart = subscription.current_period_end;
      const nextEnd = addInterval(nextStart, plan.interval, plan.interval_count ?? 1);

      await supabase
        .from("subscriptions")
        .update({
          current_period_start: nextStart,
          current_period_end: nextEnd,
          status: subscription.cancel_at_period_end
            ? "canceled"
            : subscription.status === "trialing"
              ? "active"
              : subscription.status,
          canceled_at: subscription.cancel_at_period_end ? new Date().toISOString() : null,
          trial_end: null,
        })
        .eq("id", subscription.id);

      if (discountTotal > 0 && subscription.discount_id) {
        const { data: current } = await supabase
          .from("discounts")
          .select("times_redeemed")
          .eq("id", subscription.discount_id)
          .maybeSingle();
        await supabase
          .from("discounts")
          .update({ times_redeemed: Number(current?.times_redeemed ?? 0) + 1 })
          .eq("id", subscription.discount_id);
      }

      result.created += 1;
      result.invoices.push(invoice.number);
    } catch (error) {
      result.failed += 1;
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
    }
  }

  return json({ ok: true, run_at: new Date().toISOString(), ...result });
});
