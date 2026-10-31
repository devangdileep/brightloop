"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { runBillingNow } from "@/lib/actions/row-actions";
import { Button } from "@/components/ui/button";

export function BillingRunButton({ variant = "outline" }: { variant?: "default" | "outline" | "secondary" }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      variant={variant}
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const result = await runBillingNow();
          if (!result.ok) {
            toast.error(result.error ?? "Billing run failed");
            return;
          }
          toast.success(result.message ?? "Billing run complete");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
      Run billing
    </Button>
  );
}
