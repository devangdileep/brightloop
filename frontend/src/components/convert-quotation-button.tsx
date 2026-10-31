"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileOutput, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { convertQuotationToInvoice } from "@/lib/actions/quotations";
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
  const [pending, setPending] = React.useState(false);

  async function convert() {
    setPending(true);
    try {
      const result = await convertQuotationToInvoice(quotationId);
      if (!result.ok) {
        toast.error(result.error ?? "Could not convert quotation");
        return;
      }
      toast.success(result.message ?? "Invoice created");
      setOpen(false);
      if (result.id) router.push(`/dashboard/invoices/${result.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        <FileOutput className="size-3.5" /> Convert to invoice
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Convert quotation to invoice</DialogTitle>
            <DialogDescription>
              This copies every line item and the quotation totals into a new invoice, then marks the quotation as
              accepted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={convert} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <FileOutput className="size-4" />}
              Create invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
