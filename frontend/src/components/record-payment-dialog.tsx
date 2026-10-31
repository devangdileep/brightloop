"use client";

import { CreateDialog } from "@/components/create-dialog";
import { recordPayment } from "@/lib/actions/payments";
import type { FieldDef } from "@/components/resource-form";

export function RecordPaymentDialog({
  invoices,
  defaultInvoiceId,
  defaultAmount,
  label = "Record payment",
  variant = "default",
  size = "sm",
}: {
  invoices: { value: string; label: string }[];
  defaultInvoiceId?: string;
  defaultAmount?: number | string;
  label?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}) {
  const fields: FieldDef[] = [
    {
      name: "invoice_id",
      label: "Invoice",
      type: "select",
      options: invoices,
      placeholder: "Select an open invoice…",
      required: true,
      colSpan: 2,
    },
    {
      name: "amount",
      label: "Amount",
      type: "number",
      step: "0.01",
      min: 0,
      placeholder: "0.00",
      required: true,
    },
    {
      name: "method",
      label: "Payment method",
      type: "select",
      options: [
        { value: "card", label: "Card" },
        { value: "bank_transfer", label: "Bank transfer" },
        { value: "cash", label: "Cash" },
        { value: "other", label: "Other" },
      ],
      defaultValue: "card",
    },
    { name: "paid_at", label: "Payment date", type: "date", defaultValue: new Date().toISOString().slice(0, 10), required: true },
    { name: "reference", label: "Reference", placeholder: "Txn / cheque / wire reference" },
    { name: "notes", label: "Notes", type: "textarea", placeholder: "Optional internal note" },
  ];

  return (
    <CreateDialog
      label={label}
      title="Record a payment"
      description="Payments automatically update the invoice balance and paid status."
      action={recordPayment}
      schemaKey="payment"
      fields={fields}
      defaults={{ invoice_id: defaultInvoiceId ?? "", amount: defaultAmount ?? "" }}
      submitLabel="Record payment"
      variant={variant}
      size={size}
    />
  );
}
