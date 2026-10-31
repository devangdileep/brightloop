import { requireCustomer } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import {
  PortalSubscriptionsView,
  type PortalSubscriptionItem,
} from "@/components/portal-subscriptions-view";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Boxes } from "lucide-react";

export default async function PortalSubscriptionsPage() {
  const { supabase, user } = await requireCustomer();

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  let subscriptions: PortalSubscriptionItem[] = [];

  if (customer?.id) {
    const { data } = await supabase
      .from("subscriptions")
      .select("id, status, quantity, started_at, current_period_start, current_period_end, cancel_at_period_end, notes, plan:plans(id, name, price, interval, interval_count, features, description)")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    subscriptions = (data ?? []) as unknown as PortalSubscriptionItem[];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Subscriptions"
        description="View and manage all active, paused, and renewing subscription plans."
        actions={
          <Button asChild size="sm">
            <Link href="/portal/plans">
              <Boxes className="size-4 mr-1.5" /> Browse All Plans
            </Link>
          </Button>
        }
      />
      <PortalSubscriptionsView subscriptions={subscriptions} />
    </div>
  );
}
