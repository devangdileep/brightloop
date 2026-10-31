"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, intervalLabel } from "@/lib/utils";
import { customerSubscribe } from "@/lib/actions/portal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface PlanItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  interval: "monthly" | "quarterly" | "yearly";
  interval_count: number;
  trial_days: number;
  features: string[] | null;
  is_active: boolean;
}

export function PortalPlansList({ plans }: { plans: PlanItem[] }) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = React.useState<PlanItem | null>(null);
  const [quantity, setQuantity] = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleConfirmSubscribe() {
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      const res = await customerSubscribe(selectedPlan.id, quantity);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to activate subscription");
        return;
      }
      toast.success(res.message ?? "Subscription activated!");
      setSelectedPlan(null);
      router.push("/portal/subscriptions");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isHighlighted = plan.name.toLowerCase().includes("growth") || plan.name.toLowerCase().includes("pro");
          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col justify-between transition-all ${
                isHighlighted ? "border-primary/50 shadow-md ring-1 ring-primary/20" : ""
              }`}
            >
              {isHighlighted ? (
                <div className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-0.5 text-[11px] font-medium text-primary-foreground shadow-sm">
                  Recommended
                </div>
              ) : null}
              <CardHeader className="space-y-2 pb-4">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <p className="text-xs text-muted-foreground min-h-[32px]">{plan.description || "Comprehensive software subscription"}</p>
                <div className="flex items-baseline gap-1 pt-2">
                  <span className="text-3xl font-bold tracking-tight">{formatCurrency(plan.price)}</span>
                  <span className="text-xs text-muted-foreground">/ {intervalLabel(plan.interval, plan.interval_count)}</span>
                </div>
                {plan.trial_days > 0 ? (
                  <p className="text-[11px] font-medium text-emerald-600">Includes {plan.trial_days}-day free trial</p>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="border-t pt-4">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Features Included</p>
                  <ul className="space-y-2 text-xs">
                    {(plan.features || ["Full platform access", "Email & chat support", "Automatic data backups"]).map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="size-3.5 text-primary shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  className="w-full mt-4"
                  variant={isHighlighted ? "default" : "outline"}
                  onClick={() => {
                    setSelectedPlan(plan);
                    setQuantity(1);
                  }}
                >
                  <Sparkles className="size-3.5 mr-1.5" /> Subscribe Now
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Subscription Confirmation Dialog */}
      <Dialog open={!!selectedPlan} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Subscribe to {selectedPlan?.name}</DialogTitle>
            <DialogDescription>
              Select the number of seats and confirm your subscription. An initial billing invoice will be generated automatically.
            </DialogDescription>
          </DialogHeader>

          {selectedPlan ? (
            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                <div className="flex justify-between font-medium">
                  <span>Plan:</span>
                  <span>{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Rate:</span>
                  <span>{formatCurrency(selectedPlan.price)} / {intervalLabel(selectedPlan.interval, selectedPlan.interval_count)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="seats_qty">Number of seats / licenses</Label>
                <Input
                  id="seats_qty"
                  type="number"
                  min={1}
                  max={500}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-9"
                />
              </div>

              <div className="rounded-lg border p-3 flex justify-between items-center text-sm font-semibold">
                <span>Total per billing cycle:</span>
                <span className="text-base text-primary">
                  {formatCurrency(selectedPlan.price * quantity)}
                </span>
              </div>
            </div>
          ) : null}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setSelectedPlan(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSubscribe} disabled={submitting}>
              {submitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Sparkles className="size-3.5 mr-1.5" />}
              Confirm Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
