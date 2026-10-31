"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Option = { value: string; label: string; rate?: number; type?: string; amount?: number; price?: number };

const builderSchema = z.object({
  customer_id: z.string().min(1, "Select a customer"),
  issue_date: z.string().min(1, "Issue date is required"),
  due_date: z.string().optional(),
  valid_until: z.string().optional(),
  tax_id: z.string().optional(),
  discount_id: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1, "Add a description"),
        quantity: z.coerce.number().positive("Quantity must be positive"),
        unit_price: z.coerce.number().min(0, "Price cannot be negative"),
      })
    )
    .min(1, "Add at least one line item"),
});

type Values = z.infer<typeof builderSchema>;

function today(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function LineItemsForm({
  mode,
  action,
  customers,
  taxes,
  discounts,
  plans = [],
  defaultTaxId,
  defaultCustomerId,
  currency = "USD",
}: {
  mode: "invoice" | "quotation";
  action: (formData: FormData) => Promise<ActionResult>;
  customers: Option[];
  taxes: Option[];
  discounts: Option[];
  plans?: Option[];
  defaultTaxId?: string;
  defaultCustomerId?: string;
  currency?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(builderSchema) as never,
    defaultValues: {
      customer_id: defaultCustomerId ?? "",
      issue_date: today(),
      due_date: today(14),
      valid_until: today(30),
      tax_id: defaultTaxId ?? "",
      discount_id: "",
      notes: "",
      terms: "Payment due within 14 days. Prices exclusive of applicable taxes.",
      items: [{ description: "", quantity: 1, unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const items = form.watch("items");
  const taxId = form.watch("tax_id");
  const discountId = form.watch("discount_id");
  const errors = form.formState.errors;

  const taxRate = taxes.find((tax) => tax.value === taxId)?.rate ?? 0;
  const selectedDiscount = discounts.find((discount) => discount.value === discountId);
  const subtotal = (items ?? []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0
  );
  const discountTotal = selectedDiscount
    ? selectedDiscount.type === "percentage"
      ? (subtotal * (selectedDiscount.amount ?? 0)) / 100
      : Math.min(selectedDiscount.amount ?? 0, subtotal)
    : 0;
  const taxTotal = ((subtotal - discountTotal) * taxRate) / 100;
  const total = subtotal - discountTotal + taxTotal;

  function addPlan(value: string) {
    const plan = plans.find((option) => option.value === value);
    if (!plan) return;
    append({ description: plan.label, quantity: 1, unit_price: Number(plan.price ?? 0) });
  }

  async function onSubmit(values: Values) {
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("customer_id", values.customer_id);
      formData.set("issue_date", values.issue_date);
      formData.set("notes", values.notes ?? "");
      formData.set("tax_id", values.tax_id ?? "");
      formData.set("discount_id", values.discount_id ?? "");
      formData.set("items", JSON.stringify(values.items));
      if (mode === "invoice") {
        formData.set("due_date", values.due_date ?? "");
      } else {
        formData.set("valid_until", values.valid_until ?? "");
        formData.set("terms", values.terms ?? "");
      }
      const result = await action(formData);
      if (!result.ok) {
        toast.error(result.error ?? "Could not save");
        return;
      }
      toast.success(result.message ?? "Created");
      if (result.id) {
        router.push(`/dashboard/${mode === "invoice" ? "invoices" : "quotations"}/${result.id}`);
      } else {
        router.push(`/dashboard/${mode === "invoice" ? "invoices" : "quotations"}`);
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer & dates</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer_id">Customer</Label>
              <Select id="customer_id" {...form.register("customer_id")}>
                <option value="">Select a customer…</option>
                {customers.map((customer) => (
                  <option key={customer.value} value={customer.value}>
                    {customer.label}
                  </option>
                ))}
              </Select>
              {errors.customer_id ? <p className="text-[11px] text-destructive">{errors.customer_id.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue_date">Issue date</Label>
              <Input id="issue_date" type="date" {...form.register("issue_date")} />
            </div>
            {mode === "invoice" ? (
              <div className="space-y-2">
                <Label htmlFor="due_date">Due date</Label>
                <Input id="due_date" type="date" {...form.register("due_date")} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="valid_until">Valid until</Label>
                <Input id="valid_until" type="date" {...form.register("valid_until")} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Line items</CardTitle>
              <p className="text-[12px] text-muted-foreground">What are you billing for?</p>
            </div>
            {plans.length ? (
              <Select
                className="h-8 w-44 text-[12px]"
                value=""
                onChange={(event) => {
                  addPlan(event.target.value);
                  event.target.value = "";
                }}
              >
                <option value="">Add from catalog…</option>
                {plans.map((plan) => (
                  <option key={plan.value} value={plan.value}>
                    {plan.label} · {formatCurrency(plan.price ?? 0, currency)}
                  </option>
                ))}
              </Select>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="hidden grid-cols-[1fr_80px_120px_100px_32px] gap-2 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit price</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            {fields.map((field, index) => {
              const quantity = Number(items?.[index]?.quantity) || 0;
              const price = Number(items?.[index]?.unit_price) || 0;
              return (
                <div key={field.id} className="grid gap-2 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[1fr_80px_120px_100px_32px] sm:items-start">
                  <div>
                    <Input placeholder="e.g. Growth plan — 12 seats" {...form.register(`items.${index}.description`)} />
                    {errors.items?.[index]?.description ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.items[index]?.description?.message}</p>
                    ) : null}
                  </div>
                  <Input type="number" step="1" min="1" className="text-right" {...form.register(`items.${index}.quantity`)} />
                  <Input type="number" step="0.01" min="0" className="text-right" {...form.register(`items.${index}.unit_price`)} />
                  <div className="flex h-9 items-center justify-end text-sm tabular-nums">{formatCurrency(quantity * price, currency)}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}
            {errors.items?.root ? <p className="text-[11px] text-destructive">{errors.items.root.message}</p> : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ description: "", quantity: 1, unit_price: 0 })}
            >
              <Plus className="size-3.5" /> Add line
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes & terms</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes to customer</Label>
              <Textarea id="notes" rows={3} placeholder="Thanks for your business…" {...form.register("notes")} />
            </div>
            {mode === "quotation" ? (
              <div className="space-y-2">
                <Label htmlFor="terms">Terms</Label>
                <Textarea id="terms" rows={3} {...form.register("terms")} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tax rate</Label>
              <Select {...form.register("tax_id")}>
                <option value="">No tax</option>
                {taxes.map((tax) => (
                  <option key={tax.value} value={tax.value}>
                    {tax.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Discount</Label>
              <Select {...form.register("discount_id")}>
                <option value="">No discount</option>
                {discounts.map((discount) => (
                  <option key={discount.value} value={discount.value}>
                    {discount.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2 border-t pt-4 text-[13px]">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums text-foreground">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="tabular-nums text-foreground">−{formatCurrency(discountTotal, currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax {taxRate ? `(${taxRate}%)` : ""}</span>
                <span className="tabular-nums text-foreground">{formatCurrency(taxTotal, currency)}</span>
              </div>
              <div className="flex justify-between border-t pt-3 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(total, currency)}</span>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "invoice" ? "Create invoice" : "Create quotation"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Totals are recalculated server-side before saving.
            </p>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
