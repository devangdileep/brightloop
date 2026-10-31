from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from app.core.exceptions import BadRequestException, NotFoundException
from app.database.supabase_client import SupabaseDataClient
from app.schemas.subscriptions import (
    SubscriptionCreate,
    SubscriptionLineCreate,
    SubscriptionUpdate,
)
from app.utils.date_calculations import add_billing_interval, format_date_iso, parse_date
from app.utils.pagination import PaginationParams


class SubscriptionService:
    VALID_TRANSITIONS = {
        "draft": {"quotation", "confirmed", "active", "canceled"},
        "quotation": {"confirmed", "active", "canceled"},
        "confirmed": {"active", "canceled"},
        "active": {"paused", "canceled", "closed", "past_due"},
        "trialing": {"active", "canceled", "paused"},
        "paused": {"active", "canceled", "closed"},
        "past_due": {"active", "canceled", "closed"},
        "closed": {"active", "confirmed"},
        "canceled": {"active", "confirmed"},
    }

    @staticmethod
    async def list_subscriptions(
        db: SupabaseDataClient,
        params: PaginationParams,
        customer_id: Optional[str] = None,
        status: Optional[str] = None,
        plan_id: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        filters: Dict[str, Any] = {}
        if customer_id:
            filters["customer_id"] = f"eq.{customer_id}"
        if status:
            filters["status"] = f"eq.{status}"
        if plan_id:
            filters["plan_id"] = f"eq.{plan_id}"

        data, total = await db.select(
            table="subscriptions",
            columns="*, customer:customers(id, name, email), plan:plans(id, name, price, interval, interval_count)",
            params=filters,
            order="created_at.desc",
            limit=params.limit,
            offset=params.offset,
            count="exact",
        )
        return data, total

    @staticmethod
    async def get_subscription(db: SupabaseDataClient, subscription_id: str) -> Dict[str, Any]:
        data = await db.select(
            table="subscriptions",
            columns="*, customer:customers(*), plan:plans(*)",
            params={"id": f"eq.{subscription_id}"},
            single=True,
        )
        if not data:
            raise NotFoundException("Subscription not found")

        # Fetch lines if available
        try:
            lines = await db.select(
                table="subscription_lines",
                columns="*",
                params={"subscription_id": f"eq.{subscription_id}"},
                order="sort_order.asc",
            )
            data["lines"] = lines if isinstance(lines, list) else []
        except Exception:
            data["lines"] = []

        return data

    @staticmethod
    async def create_subscription(
        db: SupabaseDataClient, payload: SubscriptionCreate, user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        # Fetch plan details
        plan = await db.select(
            table="plans",
            columns="id, interval, interval_count, trial_days, price",
            params={"id": f"eq.{payload.plan_id}"},
            single=True,
        )
        if not plan:
            raise NotFoundException("Plan not found")

        start_date = parse_date(payload.started_at) if payload.started_at else date.today()
        interval = plan.get("interval", "monthly")
        interval_count = int(plan.get("interval_count", 1))
        trial_days = int(plan.get("trial_days", 0))

        status = payload.status or ("trialing" if trial_days > 0 else "active")
        trial_end = None
        period_start = start_date

        if status == "trialing" and trial_days > 0:
            trial_end = add_billing_interval(start_date, "daily", trial_days)
            period_end = trial_end
        else:
            period_end = add_billing_interval(period_start, interval, interval_count)

        sub_data = {
            "customer_id": payload.customer_id,
            "plan_id": payload.plan_id,
            "status": status,
            "quantity": payload.quantity,
            "started_at": format_date_iso(start_date),
            "current_period_start": format_date_iso(period_start),
            "current_period_end": format_date_iso(period_end),
            "trial_end": format_date_iso(trial_end) if trial_end else None,
            "discount_id": payload.discount_id,
            "tax_id": payload.tax_id,
            "notes": payload.notes,
            "created_by": user_id,
        }

        created = await db.insert(table="subscriptions", data=sub_data, single=True)
        sub_id = created.get("id")

        # Create subscription lines if provided
        created_lines = []
        if payload.lines and sub_id:
            for idx, line in enumerate(payload.lines):
                qty = Decimal(str(line.quantity))
                u_price = Decimal(str(line.unit_price))
                amt = round(qty * u_price, 2)
                l_dict = {
                    "subscription_id": sub_id,
                    "product_id": line.product_id,
                    "variant_id": line.variant_id,
                    "plan_id": line.plan_id or payload.plan_id,
                    "description": line.description,
                    "quantity": float(qty),
                    "unit_price": float(u_price),
                    "amount": float(amt),
                    "billing_frequency": line.billing_frequency or "monthly",
                    "sort_order": line.sort_order or idx,
                }
                try:
                    ins_line = await db.insert(table="subscription_lines", data=l_dict, single=True)
                    created_lines.append(ins_line)
                except Exception:
                    pass

        created["lines"] = created_lines
        return created

    @staticmethod
    async def update_subscription(
        db: SupabaseDataClient, subscription_id: str, payload: SubscriptionUpdate
    ) -> Dict[str, Any]:
        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            return await SubscriptionService.get_subscription(db, subscription_id)

        return await db.update(
            table="subscriptions",
            data=update_data,
            params={"id": f"eq.{subscription_id}"},
            single=True,
        )

    @staticmethod
    async def transition_status(
        db: SupabaseDataClient,
        subscription_id: str,
        new_status: str,
        reason: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        sub = await SubscriptionService.get_subscription(db, subscription_id)
        current_status = sub.get("status")

        allowed = SubscriptionService.VALID_TRANSITIONS.get(current_status, set())
        if new_status not in allowed and new_status != current_status:
            raise BadRequestException(
                f"Invalid transition: cannot move subscription from '{current_status}' to '{new_status}'"
            )

        update_fields: Dict[str, Any] = {"status": new_status}
        if new_status == "canceled":
            update_fields["canceled_at"] = datetime.utcnow().isoformat()
        elif new_status == "active":
            update_fields["cancel_at_period_end"] = False

        updated = await db.update(
            table="subscriptions",
            data=update_fields,
            params={"id": f"eq.{subscription_id}"},
            single=True,
        )

        # Log event if table exists
        try:
            event_payload = {"reason": reason} if reason else {}
            await db.insert(
                table="subscription_events",
                data={
                    "subscription_id": subscription_id,
                    "event_type": f"status_{new_status}",
                    "from_status": current_status,
                    "to_status": new_status,
                    "payload": event_payload,
                    "created_by": user_id,
                },
                single=True,
            )
        except Exception:
            pass

        return updated

    @staticmethod
    async def pause_subscription(
        db: SupabaseDataClient, subscription_id: str, reason: Optional[str] = None
    ) -> Dict[str, Any]:
        return await SubscriptionService.transition_status(db, subscription_id, "paused", reason=reason)

    @staticmethod
    async def resume_subscription(db: SupabaseDataClient, subscription_id: str) -> Dict[str, Any]:
        return await SubscriptionService.transition_status(db, subscription_id, "active")

    @staticmethod
    async def cancel_subscription(
        db: SupabaseDataClient,
        subscription_id: str,
        immediate: bool = False,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        if immediate:
            return await SubscriptionService.transition_status(
                db, subscription_id, "canceled", reason=reason
            )
        else:
            return await db.update(
                table="subscriptions",
                data={"cancel_at_period_end": True},
                params={"id": f"eq.{subscription_id}"},
                single=True,
            )

    @staticmethod
    async def close_subscription(
        db: SupabaseDataClient, subscription_id: str, reason: Optional[str] = None
    ) -> Dict[str, Any]:
        # Handle 'closed' or fallback to 'canceled'
        try:
            return await SubscriptionService.transition_status(db, subscription_id, "closed", reason=reason)
        except Exception:
            return await SubscriptionService.transition_status(db, subscription_id, "canceled", reason=reason)

    @staticmethod
    async def renew_subscription(db: SupabaseDataClient, subscription_id: str) -> Dict[str, Any]:
        sub = await SubscriptionService.get_subscription(db, subscription_id)
        plan = sub.get("plan") or {}
        interval = plan.get("interval", "monthly")
        interval_count = int(plan.get("interval_count", 1))

        current_end = parse_date(sub.get("current_period_end") or date.today())
        new_start = current_end
        new_end = add_billing_interval(new_start, interval, interval_count)

        return await db.update(
            table="subscriptions",
            data={
                "status": "active",
                "current_period_start": format_date_iso(new_start),
                "current_period_end": format_date_iso(new_end),
                "cancel_at_period_end": False,
                "canceled_at": None,
            },
            params={"id": f"eq.{subscription_id}"},
            single=True,
        )

    @staticmethod
    async def get_subscription_events(
        db: SupabaseDataClient, subscription_id: str
    ) -> List[Dict[str, Any]]:
        try:
            events = await db.select(
                table="subscription_events",
                columns="*",
                params={"subscription_id": f"eq.{subscription_id}"},
                order="created_at.desc",
            )
            return events if isinstance(events, list) else []
        except Exception:
            return []
