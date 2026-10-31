"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Eye,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate, intervalLabel } from "@/lib/utils";
import {
  cancelMySubscription,
  pauseMySubscription,
  resumeMySubscription,
} from "@/lib/actions/portal";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PortalSubscriptionItem {
  id: string;
  status: string;
  quantity: number;
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  notes: string | null;
  plan: {
    id: string;
    name: string;
    price: number;
    interval: "monthly" | "quarterly" | "yearly";
    interval_count: number;
    features: string[] | null;
    description: string | null;
  } | null;
}

export function PortalSubscriptionsView({
  subscriptions,
}: {
  subscriptions: PortalSubscriptionItem[];
}) {
  const router = useRouter();
  const [selectedSub, setSelectedSub] = React.useState<PortalSubscriptionItem | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
    destructive?: boolean;
    buttonLabel: string;
  }>({
    open: false,
    title: "",
    description: "",
    action: async () => {},
    buttonLabel: "Confirm",
  });

  async function handleCancel(sub: PortalSubscriptionItem) {
    setConfirmDialog({
      open: true,
      title: "Request Subscription Cancellation",
      description: `Your subscription will remain active until ${formatDate(sub.current_period_end)}, after which it will not renew.`,
      destructive: true,
      buttonLabel: "Cancel at period end",
      action: async () => {
        setIsSubmitting(true);
        try {
          const res = await cancelMySubscription(sub.id);
          if (!res.ok) {
            toast.error(res.error ?? "Failed to request cancellation");
            return;
          }
          toast.success(res.message);
          router.refresh();
        } finally {
          setIsSubmitting(false);
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  }

  async function handleResume(sub: PortalSubscriptionItem) {
    setConfirmDialog({
      open: true,
      title: "Resume Subscription",
      description: `Reactivate auto-renewal for this plan. It will continue renewing on ${formatDate(sub.current_period_end)}.`,
      buttonLabel: "Resume Subscription",
      action: async () => {
        setIsSubmitting(true);
        try {
          const res = await resumeMySubscription(sub.id);
          if (!res.ok) {
            toast.error(res.error ?? "Failed to resume subscription");
            return;
          }
          toast.success(res.message);
          router.refresh();
        } finally {
          setIsSubmitting(false);
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  }

  async function handlePause(sub: PortalSubscriptionItem) {
    setConfirmDialog({
      open: true,
      title: "Pause Subscription",
      description: "Temporarily pause your subscription until you choose to resume it. You will not be billed while paused.",
      buttonLabel: "Pause Subscription",
      action: async () => {
        setIsSubmitting(true);
        try {
          const res = await pauseMySubscription(sub.id);
          if (!res.ok) {
            toast.error(res.error ?? "Failed to pause subscription");
            return;
          }
          toast.success(res.message);
          router.refresh();
        } finally {
          setIsSubmitting(false);
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  }

  return (
    <div className="space-y-6">
      {subscriptions.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Boxes className="mx-auto size-10 text-muted-foreground/50 mb-3" />
          <h3 className="text-base font-semibold">No subscriptions yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            You don&apos;t have any active subscriptions attached to your account yet.
          </p>
          <Button asChild size="sm">
            <Link href="/portal/plans">Browse Available Plans</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {subscriptions.map((sub) => {
            const amount = Number(sub.plan?.price ?? 0) * sub.quantity;
            return (
              <div
                key={sub.id}
                className="flex flex-col justify-between gap-4 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center hover:border-primary/40 transition-colors"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      SUB-{sub.id.slice(0, 8).toUpperCase()}
                    </span>
                    <h3 className="text-sm font-semibold">{sub.plan?.name ?? "Subscription"}</h3>
                    <StatusBadge value={sub.status} />
                    {sub.cancel_at_period_end ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                        Cancels at period end
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Started: {formatDate(sub.started_at)} · Renews: {formatDate(sub.current_period_end)} · {sub.quantity} seat{sub.quantity === 1 ? "" : "s"}
                  </p>

                  {sub.plan?.features?.length ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {sub.plan.features.slice(0, 3).map((f) => (
                        <span key={f} className="rounded-md border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {f}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t pt-3 sm:border-t-0 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-bold tabular-nums">{formatCurrency(amount)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      per {intervalLabel(sub.plan?.interval ?? "monthly", sub.plan?.interval_count ?? 1)}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8">
                        Manage <MoreHorizontal className="size-3.5 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 text-xs">
                      <DropdownMenuItem onClick={() => setSelectedSub(sub)}>
                        <Eye className="size-3.5 mr-2" /> View Details
                      </DropdownMenuItem>

                      {sub.status === "active" ? (
                        <DropdownMenuItem onClick={() => handlePause(sub)}>
                          <PauseCircle className="size-3.5 mr-2" /> Pause Subscription
                        </DropdownMenuItem>
                      ) : null}

                      {sub.status === "paused" ? (
                        <DropdownMenuItem onClick={() => handleResume(sub)}>
                          <PlayCircle className="size-3.5 mr-2" /> Resume Subscription
                        </DropdownMenuItem>
                      ) : null}

                      {sub.cancel_at_period_end ? (
                        <DropdownMenuItem onClick={() => handleResume(sub)} className="text-emerald-600">
                          <RotateCcw className="size-3.5 mr-2" /> Keep Subscription
                        </DropdownMenuItem>
                      ) : sub.status !== "canceled" ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleCancel(sub)} className="text-destructive">
                            <XCircle className="size-3.5 mr-2" /> Request Cancellation
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Subscription Details Dialog */}
      <Dialog open={!!selectedSub} onOpenChange={(open) => !open && setSelectedSub(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Subscription Details</DialogTitle>
            <DialogDescription>Full details and contract terms for this subscription.</DialogDescription>
          </DialogHeader>

          {selectedSub ? (
            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                <div className="flex justify-between font-medium">
                  <span>Subscription ID:</span>
                  <span className="font-mono">{selectedSub.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Plan:</span>
                  <span className="font-semibold">{selectedSub.plan?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <StatusBadge value={selectedSub.status} />
                </div>
              </div>

              <div className="space-y-1.5 rounded-lg border p-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quantity / Seats:</span>
                  <span className="font-medium">{selectedSub.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billing Interval:</span>
                  <span className="font-medium capitalize">{selectedSub.plan?.interval}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Started On:</span>
                  <span>{formatDate(selectedSub.started_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Period:</span>
                  <span>{formatDate(selectedSub.current_period_start)} – {formatDate(selectedSub.current_period_end)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Renewal Date:</span>
                  <span className="font-medium text-foreground">{formatDate(selectedSub.current_period_end)}</span>
                </div>
              </div>

              {selectedSub.plan?.features?.length ? (
                <div className="rounded-lg border p-3">
                  <p className="font-medium text-muted-foreground mb-1">Included Features:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                    {selectedSub.plan.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSub(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && setConfirmDialog((prev) => ({ ...prev, open: false }))}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button
              type="button"
              variant={confirmDialog.destructive ? "destructive" : "default"}
              onClick={confirmDialog.action}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
              {confirmDialog.buttonLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
