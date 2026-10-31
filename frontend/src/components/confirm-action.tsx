"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmAction({
  label,
  title,
  description,
  action,
  variant = "default",
  icon,
  successRedirect,
  className,
}: {
  label: string;
  title?: string;
  description: string;
  action: () => Promise<ActionResult>;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost";
  icon?: React.ReactNode;
  successRedirect?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function execute() {
    setPending(true);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Action failed");
        return;
      }
      toast.success(result.message ?? "Done");
      setOpen(false);
      if (successRedirect) router.push(successRedirect);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant={variant} size="sm" className={className} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{title ?? label}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant={variant === "destructive" ? "destructive" : "default"} onClick={execute} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
