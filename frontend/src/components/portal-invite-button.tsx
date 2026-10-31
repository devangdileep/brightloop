"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailPlus } from "lucide-react";
import { toast } from "sonner";
import { inviteCustomerPortal } from "@/lib/actions/customers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PortalInviteButton({
  customerId,
  email,
  disabled,
}: {
  customerId: string;
  email: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function invite() {
    setPending(true);
    try {
      const result = await inviteCustomerPortal(customerId);
      if (!result.ok) {
        toast.error(result.error ?? "Could not send invitation");
        return;
      }
      toast.success(result.message ?? "Invitation sent");
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={disabled}>
        <MailPlus className="size-3.5" /> {disabled ? "Portal active" : "Invite to portal"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite customer to portal</DialogTitle>
            <DialogDescription>
              We will email {email} a secure invitation. They will only be able to see their own subscriptions, invoices
              and payments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={invite} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <MailPlus className="size-4" />}
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
