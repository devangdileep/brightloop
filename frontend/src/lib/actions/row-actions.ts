"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createInvoiceForSubscription } from "@/lib/billing";
import { formatDate } from "@/lib/utils";
import type { ActionResult } from "@/types";

const ADMIN_ACTIONS = ["product.toggle", "plan.toggle", "discount.toggle", "tax.toggle", "payment.delete", "customer.link_user"];
const STAFF_ACTIONS = [
  "customer.toggle",
  "subscription.pause",
  "subscription.resume",
  "subscription.cancel",
  "subscription.resume_cancel",
  "subscription.generate_invoice",
  "invoice.mark_paid",
  "invoice.void",
  "invoice.mark_open",
  "quotation.send",
  "quotation.accept",
  "quotation.decline",
];

export async function runRowAction(action: string, id: string): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || !profile) return { ok: false, error: "Not authenticated" };

  if (ADMIN_ACTIONS.includes(action) && profile.role !== "admin") {
    return { ok: false, error: "Only administrators can perform this action" };
  }
  if (STAFF_ACTIONS.includes(action) && profile.role === "customer") {
    return { ok: false, error: "Staff access required" };
  }
  if (!ADMIN_ACTIONS.includes(action) && !STAFF_ACTIONS.includes(action)) {
    return { ok: false, error: "Unknown action" };
  }

  switch (action) {
    case "customer.toggle": {
      const { data } = await supabase.from("customers").select("status").eq("id", id).single();
      if (!data) return { ok: false, error: "Customer not found" };
      const next = data.status === "active" ? "inactive" : "active";
      const { error } = await supabase.from("customers").update({ status: next }).eq("id", id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: `Customer marked ${next}` };
    }

    case "product.toggle":
    case "plan.toggle":
    case "discount.toggle":
    case "tax.toggle": {
      const table = action.split(".")[0] === "product" ? "products" : action.split(".")[0] === "plan" ? "plans" : action.split(".")[0] === "discount" ? "discounts" : "taxes";
      const { data } = await supabase.from(table).select("is_active").eq("id", id).single();
      if (!data) return { ok: false, error: "Record not found" };
      const { error } = await supabase.from(table).update({ is_active: !data.is_active }).eq("id", id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: data.is_active ? "Archived" : "Activated" };
    }

    case "subscription.pause": {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "paused" })
        .eq("id", id)
        .in("status", ["active", "trialing", "past_due"]);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: "Subscription paused" };
    }

    case "subscription.resume": {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "active" })
        .eq("id", id)
        .eq("status", "paused");
      if (error) return { ok: false, error: error.message };
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: "Subscription resumed" };
    }

    case "subscription.cancel": {
      const { error } = await supabase
        .from("subscriptions")
        .update({ cancel_at_period_end: true })
        .eq("id", id)
        .neq("status", "canceled");
      if (error) return { ok: false, error: error.message };
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: "Subscription will cancel at period end" };
    }

    case "subscription.resume_cancel": {
      const { error } = await supabase
        .from("subscriptions")
        .update({ cancel_at_period_end: false })
        .eq("id", id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: "Cancellation reversed" };
    }

    case "subscription.generate_invoice": {
      try {
        const result = await createInvoiceForSubscription(supabase, id, {
          createdBy: profile.id,
          advancePeriod: true,
        });
        revalidatePath("/dashboard", "layout");
        return {
          ok: true,
          message: result.existed
            ? `Invoice ${result.invoice.number} already exists for this period`
            : `Invoice ${result.invoice.number} generated`,
          id: result.invoice.id,
        };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Billing failed" };
      }
    }

    case "invoice.mark_paid": {
      const { data: invoice, error } = await supabase
        .from("invoices")
        .select("id, number, customer_id, total, amount_paid, status")
        .eq("id", id)
        .single();
      if (error || !invoice) return { ok: false, error: error?.message ?? "Invoice not found" };
      if (invoice.status === "void") return { ok: false, error: "Void invoices cannot be paid" };
      const balance = Math.round((Number(invoice.total) - Number(invoice.amount_paid)) * 100) / 100;
      if (balance <= 0) return { ok: false, error: "Invoice is already paid" };

      const { error: paymentError } = await supabase.from("payments").insert({
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        amount: balance,
        method: "other",
        reference: "Marked paid in dashboard",
        paid_at: new Date().toISOString(),
        recorded_by: profile.id,
      });
      if (paymentError) return { ok: false, error: paymentError.message };
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: `Invoice ${invoice.number} marked paid` };
    }

    case "invoice.mark_open": {
      const { error } = await supabase.from("invoices").update({ status: "open" }).eq("id", id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: "Invoice reopened" };
    }

    case "invoice.void": {
      const { error } = await supabase.from("invoices").update({ status: "void" }).eq("id", id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: "Invoice voided" };
    }

    case "quotation.send": {
      const { error } = await supabase.from("quotations").update({ status: "sent" }).eq("id", id).eq("status", "draft");
      if (error) return { ok: false, error: error.message };
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: "Quotation marked as sent" };
    }

    case "quotation.accept": {
      const { error } = await supabase.from("quotations").update({ status: "accepted" }).eq("id", id).in("status", ["sent", "draft"]);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: "Quotation accepted" };
    }

    case "quotation.decline": {
      const { error } = await supabase.from("quotations").update({ status: "declined" }).eq("id", id).in("status", ["sent", "draft"]);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: "Quotation declined" };
    }

    case "payment.delete": {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/dashboard", "layout");
      return { ok: true, message: "Payment deleted" };
    }

    case "customer.link_user": {
      return {
        ok: false,
        error: "Use the customer page to send a portal invitation.",
      };
    }

    default:
      return { ok: false, error: "Unsupported action" };
  }
}

export async function runBillingNow(): Promise<ActionResult> {
  const { supabase, profile } = await getSessionProfile();
  if (!supabase || !profile) return { ok: false, error: "Not authenticated" };
  if (profile.role === "customer") return { ok: false, error: "Staff access required" };

  const { data: due, error } = await supabase
    .from("subscriptions")
    .select("id")
    .in("status", ["active", "past_due", "trialing"])
    .lte("current_period_end", formatDate(new Date(), "yyyy-MM-dd"));
  if (error) return { ok: false, error: error.message };

  let created = 0;
  const failures: string[] = [];
  for (const sub of due ?? []) {
    try {
      const result = await createInvoiceForSubscription(supabase, sub.id as string, {
        createdBy: profile.id,
      });
      if (!result.existed) created += 1;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Unknown error");
    }
  }

  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    message:
      created === 0
        ? `No new invoices. ${failures.length} failed.`
        : `${created} invoice${created === 1 ? "" : "s"} generated${failures.length ? `, ${failures.length} failed` : ""}`,
  };
}


