"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { runRowAction } from "@/lib/actions/row-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function RowActionButton({
  label,
  action,
  id,
  confirm,
  variant = "outline",
  size = "sm",
  icon,
  className,
  redirectTemplate,
}: {
  label: string;
  action: string;
  id: string;
  confirm?: string;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost";
  size?: "default" | "sm" | "icon";
  icon?: React.ReactNode;
  className?: string;
  redirectTemplate?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function execute() {
    setPending(true);
    try {
      const result = await runRowAction(action, id);
      if (!result.ok) {
        toast.error(result.error ?? "Action failed");
        return;
      }
      toast.success(result.message ?? "Done");
      setOpen(false);
      if (redirectTemplate && result.id) {
        router.push(redirectTemplate.replace("%s", result.id));
      } else {
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  if (!confirm) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const result = await runRowAction(action, id);
            if (!result.ok) {
              toast.error(result.error ?? "Action failed");
              return;
            }
            toast.success(result.message ?? "Done");
            if (redirectTemplate && result.id) router.push(redirectTemplate.replace("%s", result.id));
            else router.refresh();
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : icon}
        {label}
      </Button>
    );
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>{confirm}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={execute} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
