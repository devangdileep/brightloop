"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileOutput, Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { convertQuotationToInvoice, convertQuotationToSubscription } from "@/lib/actions/quotations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConvertQuotationButton({ quotationId, disabled }: { quotationId: string; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [targetType, setTargetType] = React.useState<"invoice" | "subscription">("invoice");
  const [pending, setPending] = React.useState(false);

  async function convert() {
    setPending(true);
    try {
      if (targetType === "invoice") {
        const result = await convertQuotationToInvoice(quotationId);
        if (!result.ok) {
          toast.error(result.error ?? "Could not convert quotation to invoice");
          return;
        }
        toast.success(result.message ?? "Invoice created from quotation");
        setOpen(false);
        if (result.id) router.push(`/staff/invoices/${result.id}`);
        router.refresh();
      } else {
        const result = await convertQuotationToSubscription(quotationId);
        if (!result.ok) {
          toast.error(result.error ?? "Could not convert quotation to subscription");
          return;
        }
        toast.success(result.message ?? "Subscription activated from quotation");
        setOpen(false);
        if (result.id) router.push(`/staff/subscriptions/${result.id}`);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        <FileOutput className="size-3.5" /> Convert...
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convert Quotation</DialogTitle>
            <DialogDescription>
              Choose whether to convert this proposal into an invoice or activate a customer subscription.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <button
              type="button"
              onClick={() => setTargetType("invoice")}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                targetType === "invoice" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <FileOutput className={`mt-0.5 size-5 ${targetType === "invoice" ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <div className="text-sm font-semibold">Convert to Invoice</div>
                <div className="text-xs text-muted-foreground">
                  Copies line items into a newly issued invoice with a 14-day payment term and marks this quotation as accepted.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTargetType("subscription")}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                targetType === "subscription" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <Layers className={`mt-0.5 size-5 ${targetType === "subscription" ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <div className="text-sm font-semibold">Convert to Active Subscription</div>
                <div className="text-xs text-muted-foreground">
                  Activates a recurring subscription for the customer, applying any attached discount/tax, and marks quotation as accepted.
                </div>
              </div>
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={convert} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <FileOutput className="size-4" />}
              {targetType === "invoice" ? "Generate Invoice" : "Activate Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
