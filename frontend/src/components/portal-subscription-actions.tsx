"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cancelMySubscription, resumeMySubscription } from "@/lib/actions/portal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PortalSubscriptionActions({
  subscriptionId,
  cancelAtPeriodEnd,
  periodEnd,
  status,
}: {
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
  periodEnd: string;
  status: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function execute(action: "cancel" | "resume") {
    setPending(true);
    try {
      const result = action === "cancel" ? await cancelMySubscription(subscriptionId) : await resumeMySubscription(subscriptionId);
      if (!result.ok) {
        toast.error(result.error ?? "Could not update subscription");
        return;
      }
      toast.success(result.message ?? "Subscription updated");
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (status === "canceled") {
    return <span className="text-[11px] text-muted-foreground">Canceled</span>;
  }

  if (cancelAtPeriodEnd) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <RotateCcw className="size-3.5" /> Keep subscription
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Keep your subscription?</DialogTitle>
              <DialogDescription>
                Your subscription is scheduled to end on {periodEnd}. Resume it to keep access and continue billing.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => execute("resume")} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null} Keep subscription
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(true)}>
        <XCircle className="size-3.5" /> Manage
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel subscription</DialogTitle>
            <DialogDescription>
              Your plan stays active until the end of the current period on {periodEnd}. After that, billing stops and
              you can still download past invoices.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Keep plan</Button>
            <Button variant="destructive" onClick={() => execute("cancel")} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null} Cancel at period end
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
