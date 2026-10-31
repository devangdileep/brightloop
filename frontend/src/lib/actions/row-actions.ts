"use server";

import { revalidatePath } from "next/cache";
import { api, BackendError } from "@/lib/api-client";
import { getSessionProfile } from "@/lib/auth";
import type { ActionResult } from "@/types";

const ADMIN_ACTIONS = [
  "product.toggle",
  "plan.toggle",
  "discount.toggle",
  "tax.toggle",
  "payment.delete",
  "customer.link_user",
];

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

  try {
    switch (action) {
      case "customer.toggle": {
        const customer = await api.get<{ status: string }>(`/customers/${id}`);
        const next = customer.status === "active" ? "inactive" : "active";
        await api.put(`/customers/${id}`, { status: next });
        revalidatePath("/dashboard", "layout");
        return { ok: true, message: `Customer marked ${next}` };
      }

      case "product.toggle":
      case "plan.toggle":
      case "discount.toggle":
      case "tax.toggle": {
        const table =
          action.split(".")[0] === "product"
            ? "products"
            : action.split(".")[0] === "plan"
            ? "plans"
            : action.split(".")[0] === "discount"
            ? "discounts"
            : "taxes";
        const record = await api.get<{ is_active: boolean }>(`/${table}/${id}`);
        await api.put(`/${table}/${id}`, { is_active: !record.is_active });
        revalidatePath("/dashboard", "layout");
        return { ok: true, message: record.is_active ? "Archived" : "Activated" };
      }

      case "subscription.pause": {
        await api.post(`/subscriptions/${id}/pause`);
        revalidatePath("/dashboard", "layout");
        return { ok: true, message: "Subscription paused" };
      }

      case "subscription.resume": {
        await api.post(`/subscriptions/${id}/resume`);
        revalidatePath("/dashboard", "layout");
        return { ok: true, message: "Subscription resumed" };
      }

      case "subscription.cancel": {
        await api.post(`/subscriptions/${id}/cancel`);
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
        const result = await api.post<{
          invoice: { id: string; number: string };
          already_existed: boolean;
          message?: string;
        }>(`/invoices/generate/${id}`);
        revalidatePath("/dashboard", "layout");
        return {
          ok: true,
          message: result.already_existed
            ? `Invoice ${result.invoice.number} already exists for this period`
            : `Invoice ${result.invoice.number} generated`,
          id: result.invoice.id,
        };
      }

      case "invoice.mark_paid": {
        const invoice = await api.get<{
          id: string;
          number: string;
          total: number;
          amount_paid: number;
          status: string;
        }>(`/invoices/${id}`);
        if (!invoice) return { ok: false, error: "Invoice not found" };
        if (invoice.status === "void" || invoice.status === "canceled") {
          return { ok: false, error: "Void invoices cannot be paid" };
        }
        const balance = Math.round((Number(invoice.total) - Number(invoice.amount_paid)) * 100) / 100;
        if (balance <= 0) return { ok: false, error: "Invoice is already paid" };

        await api.post("/payments", {
          invoice_id: id,
          amount: balance,
          method: "other",
          paid_at: new Date().toISOString(),
          reference: "Marked paid in dashboard",
        });
        revalidatePath("/dashboard", "layout");
        return { ok: true, message: `Invoice ${invoice.number} marked paid` };
      }

      case "invoice.mark_open": {
        await api.post(`/invoices/${id}/confirm`);
        revalidatePath("/dashboard", "layout");
        return { ok: true, message: "Invoice reopened" };
      }

      case "invoice.void": {
        await api.post(`/invoices/${id}/cancel`);
        revalidatePath("/dashboard", "layout");
        return { ok: true, message: "Invoice voided" };
      }

      case "quotation.send": {
        await api.post(`/quotations/${id}/send`);
        revalidatePath("/dashboard", "layout");
        return { ok: true, message: "Quotation marked as sent" };
      }

      case "quotation.accept": {
        await api.put(`/quotations/${id}/status`, { status: "accepted" });
        revalidatePath("/dashboard", "layout");
        return { ok: true, message: "Quotation accepted" };
      }

      case "quotation.decline": {
        await api.put(`/quotations/${id}/status`, { status: "declined" });
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
  } catch (error) {
    if (error instanceof BackendError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Action failed" };
  }
}

export async function runBillingNow(): Promise<ActionResult> {
  const { profile } = await getSessionProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (profile.role === "customer") return { ok: false, error: "Staff access required" };

  try {
    const res = await api.post<{
      ok: boolean;
      created?: number;
      invoices_created?: number;
      failed?: number;
      errors?: string[];
    }>("/billing/run", {});

    const created = res.created ?? res.invoices_created ?? 0;
    const errors = res.errors ?? [];
    revalidatePath("/dashboard", "layout");
    return {
      ok: true,
      message:
        created === 0
          ? `No new invoices. ${errors.length} failed.`
          : `${created} invoice${created === 1 ? "" : "s"} generated${errors.length ? `, ${errors.length} failed` : ""}`,
    };
  } catch (error) {
    if (error instanceof BackendError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Billing failed" };
  }
}
