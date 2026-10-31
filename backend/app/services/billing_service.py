import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from app.core.config import settings
from app.database.supabase_client import SupabaseDataClient, get_admin_db_client
from app.utils.date_calculations import add_billing_interval, format_date_iso, parse_date
from app.utils.document_numbers import generate_document_number

logger = logging.getLogger("brightloop.billing")


class BillingService:
    @staticmethod
    async def run_billing_cycle(
        db: Optional[SupabaseDataClient] = None,
        target_date: Optional[date] = None,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """
        Executes recurring billing:
        - Finds subscriptions due for billing (current_period_end <= target_date)
        - Generates invoice & lines for current period
        - Advances period to next cycle
        - Safe against duplicate billing runs (checks existing invoice + unique constraint)
        """
        run_date = target_date or date.today()
        target_str = format_date_iso(run_date)

        # Use provided client or privileged admin client for background jobs
        client = db or get_admin_db_client()

        # Fetch app_settings for due days & currency
        due_days = 14
        currency = "USD"
        try:
            settings_res = await client.select(
                table="app_settings",
                columns="invoice_due_days, currency",
                params={"id": "eq.1"},
                single=True,
            )
            if settings_res:
                due_days = int(settings_res.get("invoice_due_days") or 14)
                currency = settings_res.get("currency") or "USD"
        except Exception as e:
            logger.warning(f"Could not load app_settings: {e}. Using defaults.")

        # Find eligible subscriptions: active or past_due or trialing, due on or before target_date
        # Note: in PostgREST, we can query status in (active, past_due, trialing)
        try:
            due_subscriptions = await client.select(
                table="subscriptions",
                columns="*, customer:customers(*), plan:plans(*), discount:discounts(*), tax:taxes(*)",
                params={
                    "status": "in.(active,past_due,trialing)",
                    "current_period_end": f"lte.{target_str}",
                },
            )
        except Exception as e:
            logger.error(f"Failed to fetch due subscriptions: {e}")
            return {
                "ok": False,
                "processed": 0,
                "created": 0,
                "skipped": 0,
                "failed": 1,
                "invoices": [],
                "errors": [str(e)],
                "run_at": datetime.utcnow().isoformat(),
            }

        subscriptions_list = due_subscriptions if isinstance(due_subscriptions, list) else []
        logger.info(f"Found {len(subscriptions_list)} subscriptions due for billing as of {target_str}")

        created_invoices: List[str] = []
        errors: List[str] = []
        skipped_count = 0
        failed_count = 0

        for sub in subscriptions_list:
            sub_id = sub["id"]
            period_start = sub.get("current_period_start")
            period_end = sub.get("current_period_end")

            try:
                # 1. Idempotency Check: check if invoice already exists for this subscription & period
                existing_invoice = await client.select(
                    table="invoices",
                    columns="id, number",
                    params={
                        "subscription_id": f"eq.{sub_id}",
                        "period_start": f"eq.{period_start}",
                    },
                )
                if existing_invoice and len(existing_invoice) > 0:
                    logger.info(f"Subscription {sub_id} already has invoice for period {period_start}. Skipping.")
                    skipped_count += 1
                    continue

                if dry_run:
                    created_invoices.append(f"DRY-RUN-{sub_id[:8]}")
                    continue

                # 2. Plan and Pricing Details
                plan = sub.get("plan")
                if not plan and sub.get("plan_id"):
                    plan = await client.select(table="plans", params={"id": f"eq.{sub['plan_id']}"}, single=True)

                if not plan:
                    raise ValueError(f"Subscription {sub_id} has no valid associated plan")

                interval = plan.get("interval", "monthly")
                interval_count = int(plan.get("interval_count", 1))
                quantity = Decimal(str(sub.get("quantity", 1)))
                unit_price = Decimal(str(plan.get("price", 0)))
                subtotal = round(quantity * unit_price, 2)

                # 3. Discount Validation
                discount_total = Decimal("0.00")
                discount = sub.get("discount")
                if not discount and sub.get("discount_id"):
                    try:
                        discount = await client.select(table="discounts", params={"id": f"eq.{sub['discount_id']}"}, single=True)
                    except Exception:
                        discount = None
                if discount and discount.get("is_active"):
                    v_from = discount.get("valid_from")
                    v_until = discount.get("valid_until")
                    max_redemptions = discount.get("max_redemptions")
                    times_redeemed = discount.get("times_redeemed", 0)

                    valid = True
                    if v_from and parse_date(v_from) > run_date:
                        valid = False
                    if v_until and parse_date(v_until) < run_date:
                        valid = False
                    if max_redemptions is not None and times_redeemed >= max_redemptions:
                        valid = False

                    if valid:
                        d_type = discount.get("type", "percentage")
                        d_val = Decimal(str(discount.get("value", 0)))
                        if d_type == "percentage":
                            discount_total = round(subtotal * (d_val / Decimal("100")), 2)
                        else:
                            discount_total = min(d_val, subtotal)

                # 4. Tax Calculation
                tax_total = Decimal("0.00")
                tax = sub.get("tax")
                if tax:
                    t_rate = Decimal(str(tax.get("rate", 0)))
                    tax_total = round((subtotal - discount_total) * (t_rate / Decimal("100")), 2)

                total = subtotal - discount_total + tax_total

                # 5. Dates
                issue_date_obj = date.today()
                due_date_obj = add_billing_interval(issue_date_obj, "daily", due_days)

                # 6. Document Number
                invoice_number = await generate_document_number(client, "invoice")

                # 7. Create Invoice
                invoice_payload = {
                    "number": invoice_number,
                    "customer_id": sub["customer_id"],
                    "subscription_id": sub_id,
                    "status": "open",
                    "issue_date": format_date_iso(issue_date_obj),
                    "due_date": format_date_iso(due_date_obj),
                    "period_start": period_start,
                    "period_end": period_end,
                    "subtotal": float(subtotal),
                    "discount_total": float(discount_total),
                    "tax_total": float(tax_total),
                    "total": float(total),
                    "amount_paid": 0.0,
                    "currency": currency,
                    "notes": f"Auto-generated recurring invoice for period {period_start} to {period_end}",
                }

                try:
                    created_inv = await client.insert(table="invoices", data=invoice_payload, single=True)
                except Exception as db_err:
                    # Uniqueness constraint conflict: another worker already generated invoice
                    if "invoices_subscription_period" in str(db_err) or "duplicate key" in str(db_err):
                        logger.info(f"Subscription {sub_id} invoice was created concurrently. Skipping.")
                        skipped_count += 1
                        continue
                    raise

                inv_id = created_inv.get("id")

                # 8. Create Invoice Line Item
                plan_name = plan.get("name", "Plan")
                item_desc = f"{plan_name} subscription — {quantity} seat{'s' if quantity > 1 else ''}"
                await client.insert(
                    table="invoice_items",
                    data={
                        "invoice_id": inv_id,
                        "description": item_desc,
                        "quantity": float(quantity),
                        "unit_price": float(unit_price),
                        "amount": float(subtotal),
                        "sort_order": 0,
                    },
                    single=True,
                )

                # 9. Advance Subscription Period & Status
                next_start = parse_date(period_end)
                next_end = add_billing_interval(next_start, interval, interval_count)

                cancel_at_end = sub.get("cancel_at_period_end", False)
                next_status = "canceled" if cancel_at_end else "active"

                sub_update: Dict[str, Any] = {
                    "current_period_start": format_date_iso(next_start),
                    "current_period_end": format_date_iso(next_end),
                    "status": next_status,
                }
                if cancel_at_end:
                    sub_update["canceled_at"] = datetime.utcnow().isoformat()

                await client.update(
                    table="subscriptions",
                    data=sub_update,
                    params={"id": f"eq.{sub_id}"},
                    single=True,
                )

                # 10. Update discount usage if applied
                if discount_total > 0 and sub.get("discount_id"):
                    try:
                        from app.services.discount_service import DiscountService
                        await DiscountService.record_redemption(
                            client,
                            discount_id=sub["discount_id"],
                            amount=discount_total,
                            customer_id=sub["customer_id"],
                            invoice_id=inv_id,
                        )
                    except Exception as disc_err:
                        logger.warning(f"Could not record discount usage: {disc_err}")

                created_invoices.append(invoice_number)
                logger.info(f"Generated invoice {invoice_number} for subscription {sub_id}")

            except Exception as item_err:
                failed_count += 1
                err_msg = f"Subscription {sub_id}: {str(item_err)}"
                errors.append(err_msg)
                logger.error(err_msg)

        result = {
            "ok": failed_count == 0,
            "processed": len(subscriptions_list),
            "created": len(created_invoices),
            "skipped": skipped_count,
            "failed": failed_count,
            "invoices": created_invoices,
            "errors": errors,
            "run_at": datetime.utcnow().isoformat(),
        }
        logger.info(f"Billing cycle completed: {result}")
        return result
