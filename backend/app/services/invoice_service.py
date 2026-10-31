from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.database.supabase_client import SupabaseDataClient
from app.schemas.invoices import InvoiceCreate
from app.utils.date_calculations import add_billing_interval, format_date_iso, parse_date
from app.utils.document_numbers import generate_document_number
from app.utils.pagination import PaginationParams


class InvoiceService:
    @staticmethod
    async def list_invoices(
        db: SupabaseDataClient,
        params: PaginationParams,
        customer_id: Optional[str] = None,
        subscription_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        filters: Dict[str, Any] = {}
        if customer_id:
            filters["customer_id"] = f"eq.{customer_id}"
        if subscription_id:
            filters["subscription_id"] = f"eq.{subscription_id}"
        if status:
            filters["status"] = f"eq.{status}"

        data, total = await db.select(
            table="invoices",
            columns="*, customer:customers(id, name, email)",
            params=filters,
            order="issue_date.desc",
            limit=params.limit,
            offset=params.offset,
            count="exact",
        )

        for inv in data:
            tot = Decimal(str(inv.get("total", 0)))
            paid = Decimal(str(inv.get("amount_paid", 0)))
            inv["outstanding_balance"] = float(max(Decimal("0.00"), tot - paid))

        return data, total

    @staticmethod
    async def get_invoice(db: SupabaseDataClient, invoice_id: str) -> Dict[str, Any]:
        data = await db.select(
            table="invoices",
            columns="*, customer:customers(*), items:invoice_items(*)",
            params={"id": f"eq.{invoice_id}"},
            single=True,
        )
        if not data:
            raise NotFoundException("Invoice not found")

        tot = Decimal(str(data.get("total", 0)))
        paid = Decimal(str(data.get("amount_paid", 0)))
        data["outstanding_balance"] = float(max(Decimal("0.00"), tot - paid))
        return data

    @staticmethod
    async def create_invoice(
        db: SupabaseDataClient, payload: InvoiceCreate, user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        items_payload = []
        subtotal = Decimal("0.00")
        for idx, item in enumerate(payload.items):
            qty = Decimal(str(item.quantity))
            price = Decimal(str(item.unit_price))
            item_amount = round(qty * price, 2)
            subtotal += item_amount
            items_payload.append({
                "description": item.description,
                "quantity": float(qty),
                "unit_price": float(price),
                "amount": float(item_amount),
                "sort_order": item.sort_order or idx,
            })

        # Calculate discount
        discount_total = Decimal("0.00")
        if payload.discount_id:
            try:
                discount = await db.select(
                    table="discounts",
                    columns="*",
                    params={"id": f"eq.{payload.discount_id}"},
                    single=True,
                )
                if discount and discount.get("is_active"):
                    d_type = discount.get("type", "percentage")
                    d_val = Decimal(str(discount.get("value", 0)))
                    if d_type == "percentage":
                        discount_total = round(subtotal * (d_val / Decimal("100")), 2)
                    else:
                        discount_total = min(d_val, subtotal)
            except Exception:
                pass

        # Calculate tax
        tax_total = Decimal("0.00")
        if payload.tax_id:
            try:
                tax = await db.select(
                    table="taxes",
                    columns="rate",
                    params={"id": f"eq.{payload.tax_id}"},
                    single=True,
                )
                if tax:
                    tax_rate = Decimal(str(tax.get("rate", 0)))
                    tax_total = round((subtotal - discount_total) * (tax_rate / Decimal("100")), 2)
            except Exception:
                pass

        total = subtotal - discount_total + tax_total

        # Settings for due days
        issue_date = parse_date(payload.issue_date) if payload.issue_date else date.today()
        due_date = parse_date(payload.due_date) if payload.due_date else add_billing_interval(issue_date, "daily", 14)

        number = await generate_document_number(db, "invoice")

        invoice_data = {
            "number": number,
            "customer_id": payload.customer_id,
            "subscription_id": payload.subscription_id,
            "status": "open",
            "issue_date": format_date_iso(issue_date),
            "due_date": format_date_iso(due_date),
            "period_start": payload.period_start,
            "period_end": payload.period_end,
            "subtotal": float(subtotal),
            "discount_total": float(discount_total),
            "tax_total": float(tax_total),
            "total": float(total),
            "amount_paid": 0.0,
            "currency": payload.currency,
            "notes": payload.notes,
            "created_by": user_id,
        }

        created = await db.insert(table="invoices", data=invoice_data, single=True)
        invoice_id = created.get("id")

        created_items = []
        for item in items_payload:
            item["invoice_id"] = invoice_id
            ins = await db.insert(table="invoice_items", data=item, single=True)
            created_items.append(ins)

        created["items"] = created_items
        created["outstanding_balance"] = float(total)
        return created

    @staticmethod
    async def generate_invoice_for_subscription(
        db: SupabaseDataClient, subscription_id: str, user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        # Fetch subscription with customer, plan, discount, tax
        sub = await db.select(
            table="subscriptions",
            columns="*, customer:customers(*), plan:plans(*), discount:discounts(*), tax:taxes(*)",
            params={"id": f"eq.{subscription_id}"},
            single=True,
        )
        if not sub:
            raise NotFoundException("Subscription not found")

        period_start = sub.get("current_period_start")
        period_end = sub.get("current_period_end")

        # Check idempotency: does an invoice already exist for this subscription + period?
        existing = await db.select(
            table="invoices",
            columns="id, number, status, total, amount_paid",
            params={
                "subscription_id": f"eq.{subscription_id}",
                "period_start": f"eq.{period_start}",
            },
        )
        if existing and len(existing) > 0:
            existing_inv = existing[0]
            tot = Decimal(str(existing_inv.get("total", 0)))
            paid = Decimal(str(existing_inv.get("amount_paid", 0)))
            existing_inv["outstanding_balance"] = float(max(Decimal("0.00"), tot - paid))
            return {
                "invoice": existing_inv,
                "already_existed": True,
                "message": f"Invoice {existing_inv.get('number')} already exists for current period",
            }

        plan = sub.get("plan")
        if not plan and sub.get("plan_id"):
            plan = await db.select(table="plans", params={"id": f"eq.{sub['plan_id']}"}, single=True)

        quantity = Decimal(str(sub.get("quantity", 1)))
        unit_price = Decimal(str(plan.get("price", 0) if plan else 0))
        subtotal = round(quantity * unit_price, 2)

        # Calculate discount
        discount_total = Decimal("0.00")
        discount = sub.get("discount")
        if not discount and sub.get("discount_id"):
            try:
                discount = await db.select(table="discounts", params={"id": f"eq.{sub['discount_id']}"}, single=True)
            except Exception:
                discount = None

        if discount and discount.get("is_active"):
            d_type = discount.get("type", "percentage")
            d_val = Decimal(str(discount.get("value", 0)))
            if d_type == "percentage":
                discount_total = round(subtotal * (d_val / Decimal("100")), 2)
            else:
                discount_total = min(d_val, subtotal)

        # Calculate tax
        tax_total = Decimal("0.00")
        tax = sub.get("tax")
        if not tax and sub.get("tax_id"):
            try:
                tax = await db.select(table="taxes", params={"id": f"eq.{sub['tax_id']}"}, single=True)
            except Exception:
                tax = None

        if tax:
            t_rate = Decimal(str(tax.get("rate", 0)))
            tax_total = round((subtotal - discount_total) * (t_rate / Decimal("100")), 2)

        total = subtotal - discount_total + tax_total

        number = await generate_document_number(db, "invoice")
        issue_date = date.today()
        due_date = add_billing_interval(issue_date, "daily", 14)

        invoice_payload = {
            "number": number,
            "customer_id": sub["customer_id"],
            "subscription_id": subscription_id,
            "status": "open",
            "issue_date": format_date_iso(issue_date),
            "due_date": format_date_iso(due_date),
            "period_start": period_start,
            "period_end": period_end,
            "subtotal": float(subtotal),
            "discount_total": float(discount_total),
            "tax_total": float(tax_total),
            "total": float(total),
            "amount_paid": 0.0,
            "currency": "USD",
            "notes": f"Auto-generated invoice for {plan.get('name', 'Subscription')}",
            "created_by": user_id,
        }

        created = await db.insert(table="invoices", data=invoice_payload, single=True)
        inv_id = created.get("id")

        # Create item
        plan_name = plan.get("name", "Plan")
        item_desc = f"{plan_name} subscription — {quantity} seat{'s' if quantity > 1 else ''}"
        await db.insert(
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

        created["outstanding_balance"] = float(total)
        return {"invoice": created, "already_existed": False}

    @staticmethod
    async def confirm_invoice(db: SupabaseDataClient, invoice_id: str) -> Dict[str, Any]:
        return await db.update(
            table="invoices",
            data={"status": "open"},
            params={"id": f"eq.{invoice_id}"},
            single=True,
        )

    @staticmethod
    async def cancel_invoice(db: SupabaseDataClient, invoice_id: str) -> Dict[str, Any]:
        inv = await InvoiceService.get_invoice(db, invoice_id)
        if inv.get("status") == "paid":
            raise BadRequestException("Cannot cancel an already paid invoice")

        return await db.update(
            table="invoices",
            data={"status": "void"},
            params={"id": f"eq.{invoice_id}"},
            single=True,
        )
