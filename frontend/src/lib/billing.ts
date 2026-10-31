import { addInterval, formatDate } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient;

export interface BillingResult {
  created: number;
  skipped: number;
  errors: string[];
  invoices: { id: string; number: string; customer: string }[];
}

/**
 * Creates one invoice for a subscription's current period, advancing the
 * subscription period afterwards. Safe to call repeatedly: an existing invoice
 * for the same subscription + period is returned instead of duplicated.
 */
export async function createInvoiceForSubscription(
  client: Client,
  subscriptionId: string,
  options: { createdBy?: string | null; issueDate?: Date; advancePeriod?: boolean } = {}
) {
  const { data: subscription, error } = await client
    .from("subscriptions")
    .select(
      "id, customer_id, plan_id, status, quantity, started_at, current_period_start, current_period_end, cancel_at_period_end, discount_id, tax_id, plan:plans(id,name,price,interval,interval_count), customer:customers(id,name,email,address,tax_id), discount:discounts(id,code,type,value,is_active,valid_from,valid_until), tax:taxes(id,name,rate)"
    )
    .eq("id", subscriptionId)
    .single();

  if (error || !subscription) throw new Error(error?.message ?? "Subscription not found");

  const plan = subscription.plan as unknown as {
    id: string;
    name: string;
    price: number;
    interval: string;
    interval_count: number;
  } | null;
  const customer = subscription.customer as unknown as { id: string; name: string } | null;
  if (!plan) throw new Error("Subscription has no plan");

  const issueDate = options.issueDate ?? new Date();
  const periodStart = subscription.current_period_start as string;
  const periodEnd = subscription.current_period_end as string;

  const { data: existing } = await client
    .from("invoices")
    .select("id, number")
    .eq("subscription_id", subscriptionId)
    .eq("period_start", periodStart)
    .maybeSingle();

  if (existing) {
    return { invoice: existing, existed: true, subscription };
  }

  const { data: settings } = await client.from("app_settings").select("*").eq("id", 1).maybeSingle();
  const dueDays = settings?.invoice_due_days ?? 14;
  const currency = settings?.currency ?? "USD";

  const quantity = Number(subscription.quantity ?? 1);
  const subtotal = Math.round(Number(plan.price) * quantity * 100) / 100;
  const discount = subscription.discount as unknown as {
    type: string;
    value: number;
    is_active: boolean;
    valid_until: string | null;
    valid_from: string | null;
  } | null;

  let discountTotal = 0;
  const today = formatDate(issueDate, "yyyy-MM-dd");
  const discountValid =
    discount &&
    discount.is_active &&
    (!discount.valid_until || discount.valid_until >= today) &&
    (!discount.valid_from || discount.valid_from <= today);

  if (discountValid && discount) {
    discountTotal =
      discount.type === "percentage"
        ? Math.round(subtotal * (Number(discount.value) / 100) * 100) / 100
        : Math.min(Number(discount.value), subtotal);
  }

  const tax = subscription.tax as unknown as { rate: number } | null;
  const taxTotal = Math.round((subtotal - discountTotal) * (Number(tax?.rate ?? 0) / 100) * 100) / 100;
  const total = Math.round((subtotal - discountTotal + taxTotal) * 100) / 100;

  const { data: numberData, error: numberError } = await client.rpc("next_document_number", {
    p_kind: "invoice",
  });
  if (numberError) throw new Error(numberError.message);
  const number = numberData as string;

  const { data: invoice, error: invoiceError } = await client
    .from("invoices")
    .insert({
      number,
      customer_id: subscription.customer_id,
      subscription_id: subscriptionId,
      status: "open",
      issue_date: today,
      due_date: formatDate(new Date(issueDate.getTime() + dueDays * 86400000), "yyyy-MM-dd"),
      period_start: periodStart,
      period_end: periodEnd,
      subtotal,
      discount_total: discountTotal,
      tax_total: taxTotal,
      total,
      currency,
      created_by: options.createdBy ?? null,
    })
    .select("id, number, customer_id")
    .single();

  if (invoiceError || !invoice) throw new Error(invoiceError?.message ?? "Could not create invoice");

  const { error: itemError } = await client.from("invoice_items").insert({
    invoice_id: invoice.id,
    description: `${plan.name} subscription — ${quantity} ${quantity === 1 ? "seat" : "seats"}`,
    quantity,
    unit_price: plan.price,
    amount: subtotal,
    sort_order: 0,
  });
  if (itemError) throw new Error(itemError.message);

  if (options.advancePeriod !== false) {
    const nextStart = periodEnd;
    const nextEnd = addInterval(new Date(`${periodEnd}T00:00:00`), plan.interval, plan.interval_count ?? 1);
    const nextStatus =
      subscription.status === "trialing" ? "active" : subscription.status;

    await client
      .from("subscriptions")
      .update({
        current_period_start: nextStart,
        current_period_end: formatDate(nextEnd, "yyyy-MM-dd"),
        status: subscription.cancel_at_period_end && subscription.status !== "canceled" ? "canceled" : nextStatus,
        canceled_at: subscription.cancel_at_period_end ? new Date().toISOString() : null,
        trial_end: null,
      })
      .eq("id", subscriptionId);
  }

  if (discountTotal > 0 && subscription.discount_id) {
    const { data: current } = await client
      .from("discounts")
      .select("times_redeemed")
      .eq("id", subscription.discount_id)
      .maybeSingle();
    await client
      .from("discounts")
      .update({ times_redeemed: Number(current?.times_redeemed ?? 0) + 1 })
      .eq("id", subscription.discount_id);
  }

  return {
    invoice: { ...invoice, customer_name: customer?.name },
    existed: false,
    subscription,
  };
}

export async function runBillingCycle(
  client: Client,
  options: { createdBy?: string | null } = {}
): Promise<BillingResult> {
  const today = formatDate(new Date(), "yyyy-MM-dd");
  const { data: subscriptions, error } = await client
    .from("subscriptions")
    .select("id")
    .in("status", ["active", "past_due", "trialing"])
    .lte("current_period_end", today);

  if (error) return { created: 0, skipped: 0, errors: [error.message], invoices: [] };

  const result: BillingResult = { created: 0, skipped: 0, errors: [], invoices: [] };

  for (const sub of subscriptions ?? []) {
    try {
      const created = await createInvoiceForSubscription(client, sub.id as string, {
        createdBy: options.createdBy ?? null,
      });
      if (created.existed) {
        result.skipped += 1;
      } else {
        result.created += 1;
        result.invoices.push({
          id: created.invoice.id,
          number: created.invoice.number,
          customer: (created.invoice as { customer_name?: string }).customer_name ?? "",
        });
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Unknown billing error");
    }
  }

  return result;
}
