import { CalendarClock, CircleDollarSign, PauseCircle, PlayCircle } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createSubscription } from "@/lib/actions/subscriptions";
import { formatCurrency, monthlyValue } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { CreateDialog } from "@/components/create-dialog";
import { DataTable, type TableColumn, type TableRowData } from "@/components/data-table";
import { StatCard } from "@/components/dashboard/stat-card";
import type { FieldDef } from "@/components/resource-form";

export default async function SubscriptionsPage() {
  const { supabase } = await requireStaff();

  const [subscriptionsRes, customersRes, plansRes, discountsRes, taxesRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "id, status, quantity, started_at, current_period_start, current_period_end, trial_end, cancel_at_period_end, notes, plan:plans(name,price,interval,interval_count), customer:customers(id,name,email,discount_id), discount:discounts(code), tax:taxes(name,rate)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id, name, email").eq("status", "active").order("name"),
    supabase.from("plans").select("id, name, price, interval, trial_days").eq("is_active", true).order("price"),
    supabase.from("discounts").select("id, code").eq("is_active", true).order("code"),
    supabase.from("taxes").select("id, name, rate").eq("is_active", true).order("name"),
  ]);

  const subscriptions = (subscriptionsRes.data ?? []) as unknown as Array<{
    id: string;
    status: string;
    quantity: number;
    started_at: string;
    current_period_start: string;
    current_period_end: string;
    trial_end: string | null;
    cancel_at_period_end: boolean;
    notes: string | null;
    plan: { name: string; price: number; interval: string; interval_count: number } | null;
    customer: { id: string; name: string; email: string } | null;
    discount: { code: string } | null;
    tax: { name: string; rate: number } | null;
  }>;

  const mrr = subscriptions
    .filter((sub) => sub.status === "active" || sub.status === "trialing")
    .reduce((sum, sub) => {
      if (!sub.plan) return sum;
      return sum + monthlyValue(Number(sub.plan.price) * sub.quantity, sub.plan.interval, sub.plan.interval_count);
    }, 0);
  const active = subscriptions.filter((sub) => sub.status === "active").length;
  const trialing = subscriptions.filter((sub) => sub.status === "trialing").length;
  const paused = subscriptions.filter((sub) => sub.status === "paused").length;

  const customerOptions = ((customersRes.data ?? []) as unknown as Array<{ id: string; name: string; email: string }>).map((customer) => ({
    value: customer.id,
    label: `${customer.name} · ${customer.email}`,
  }));
  const planOptions = ((plansRes.data ?? []) as unknown as Array<{ id: string; name: string; price: number; interval: string; trial_days: number }>).map((plan) => ({
    value: plan.id,
    label: `${plan.name} · ${formatCurrency(Number(plan.price))}/${plan.interval}`,
  }));
  const discountOptions = ((discountsRes.data ?? []) as unknown as Array<{ id: string; code: string }>).map((discount) => ({
    value: discount.id,
    label: discount.code,
  }));
  const taxOptions = ((taxesRes.data ?? []) as unknown as Array<{ id: string; name: string; rate: number }>).map((tax) => ({
    value: tax.id,
    label: `${tax.name} (${tax.rate}%)`,
  }));

  const fields: FieldDef[] = [
    { name: "customer_id", label: "Customer", type: "select", options: customerOptions, placeholder: "Select a customer…", colSpan: 2, required: true },
    { name: "plan_id", label: "Plan", type: "select", options: planOptions, placeholder: "Select a plan…", colSpan: 2, required: true },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "active", label: "Active" },
        { value: "trialing", label: "Trialing" },
        { value: "paused", label: "Paused" },
      ],
      defaultValue: "active",
    },
    { name: "quantity", label: "Quantity / seats", type: "number", min: 1, defaultValue: 1 },
    { name: "started_at", label: "Start date", type: "date", defaultValue: new Date().toISOString().slice(0, 10), required: true },
    {
      name: "discount_id",
      label: "Discount",
      type: "select",
      options: discountOptions,
      placeholder: "No discount",
    },
    { name: "tax_id", label: "Tax rate", type: "select", options: taxOptions, placeholder: "No tax" },
    { name: "notes", label: "Notes", type: "textarea", placeholder: "Contract details, PO number…" },
  ];

  const rows: TableRowData[] = subscriptions.map((sub) => {
    const actions: TableRowData["_actions"] = [];
    if (sub.status === "paused") {
      actions.push({ label: "Resume subscription", action: "subscription.resume", confirm: "Resume billing for this subscription?" });
    } else if (sub.status !== "canceled") {
      actions.push({
        label: "Pause subscription",
        action: "subscription.pause",
        confirm: "Pausing stops invoice generation until the subscription is resumed.",
      });
    }
    if (sub.cancel_at_period_end) {
      actions.push({ label: "Reverse cancellation", action: "subscription.resume_cancel", confirm: "Keep this subscription active after the current period?" });
    } else if (sub.status !== "canceled") {
      actions.push({
        label: "Cancel at period end",
        action: "subscription.cancel",
        confirm: "The subscription stays active until the current period ends, then cancels.",
        destructive: true,
      });
    }
    actions.push({
      label: "Generate invoice",
      action: "subscription.generate_invoice",
      confirm: "Generate an invoice for the current period and advance the renewal date?",
    });

    return {
      id: sub.id,
      _href: `/dashboard/subscriptions/${sub.id}`,
      _actions: actions,
      customer: sub.customer?.name ?? "—",
      customerEmail: sub.customer?.email ?? "",
      plan: sub.plan?.name ?? "—",
      status: sub.status,
      quantity: sub.quantity,
      price: sub.plan ? Number(sub.plan.price) * sub.quantity : 0,
      interval: sub.plan ? `/${sub.plan.interval}` : "",
      renewal: sub.current_period_end,
      canceling: sub.cancel_at_period_end ? "Yes" : "No",
      notes: sub.notes ?? "",
    };
  });

  const columns: TableColumn[] = [
    { key: "customer", header: "Customer", kind: "entity", subKey: "customerEmail" },
    { key: "plan", header: "Plan" },
    { key: "status", header: "Status", kind: "badge" },
    { key: "quantity", header: "Seats", kind: "number", align: "right" },
    { key: "price", header: "Value", kind: "currency", align: "right" },
    { key: "renewal", header: "Renews", kind: "date" },
    { key: "canceling", header: "Canceling" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description={`${subscriptions.length} total · ${active} active · ${trialing} trialing · ${paused} paused`}
        actions={
          <CreateDialog
            label="New subscription"
            title="Create subscription"
            description="The billing period is calculated from the plan interval and start date."
            action={createSubscription}
            schemaKey="subscription"
            fields={fields}
            submitLabel="Create subscription"
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Monthly recurring revenue" value={formatCurrency(mrr)} hint="active & trialing" icon={<CircleDollarSign className="size-4" />} />
        <StatCard label="Active subscriptions" value={String(active)} hint="billing normally" icon={<PlayCircle className="size-4" />} />
        <StatCard label="On trial" value={String(trialing)} hint="converting soon" icon={<CalendarClock className="size-4" />} />
        <StatCard label="Paused" value={String(paused)} hint="billing suspended" icon={<PauseCircle className="size-4" />} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        searchPlaceholder="Search customer, plan, status…"
        emptyTitle="No subscriptions yet"
        emptyDescription="Create a subscription to start recurring billing for a customer."
      />
    </div>
  );
}
