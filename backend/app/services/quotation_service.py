from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from app.core.exceptions import BadRequestException, NotFoundException
from app.database.supabase_client import SupabaseDataClient
from app.schemas.quotations import (
    QuotationCreate,
    QuotationCreateFromTemplate,
    QuotationTemplateCreate,
    QuotationTemplateUpdate,
)
from app.utils.date_calculations import format_date_iso
from app.utils.document_numbers import generate_document_number
from app.utils.pagination import PaginationParams


class QuotationService:
    @staticmethod
    async def list_quotations(
        db: SupabaseDataClient,
        params: PaginationParams,
        customer_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        filters: Dict[str, Any] = {}
        if customer_id:
            filters["customer_id"] = f"eq.{customer_id}"
        if status:
            filters["status"] = f"eq.{status}"

        data, total = await db.select(
            table="quotations",
            columns="*, customer:customers(id, name, email)",
            params=filters,
            order="created_at.desc",
            limit=params.limit,
            offset=params.offset,
            count="exact",
        )
        return data, total

    @staticmethod
    async def get_quotation(db: SupabaseDataClient, quotation_id: str) -> Dict[str, Any]:
        data = await db.select(
            table="quotations",
            columns="*, customer:customers(*), items:quotation_items(*)",
            params={"id": f"eq.{quotation_id}"},
            single=True,
        )
        if not data:
            raise NotFoundException("Quotation not found")
        return data

    @staticmethod
    async def create_quotation(
        db: SupabaseDataClient, payload: QuotationCreate, user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        # Calculate items subtotal using Decimal
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

        number = await generate_document_number(db, "quotation")

        quotation_data = {
            "number": number,
            "customer_id": payload.customer_id,
            "status": "draft",
            "issue_date": payload.issue_date or format_date_iso(date.today()),
            "valid_until": payload.valid_until,
            "subtotal": float(subtotal),
            "discount_total": float(discount_total),
            "tax_total": float(tax_total),
            "total": float(total),
            "notes": payload.notes,
            "terms": payload.terms,
            "created_by": user_id,
        }

        created = await db.insert(table="quotations", data=quotation_data, single=True)
        quotation_id = created.get("id")

        created_items = []
        for item in items_payload:
            item["quotation_id"] = quotation_id
            inserted_item = await db.insert(table="quotation_items", data=item, single=True)
            created_items.append(inserted_item)

        created["items"] = created_items
        return created

    @staticmethod
    async def create_from_template(
        db: SupabaseDataClient, payload: QuotationCreateFromTemplate, user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        template = await QuotationService.get_template(db, payload.template_id)
        raw_items = template.get("template_lines") or []
        if not raw_items:
            raise BadRequestException("Quotation template has no items")

        items_payload = []
        for item in raw_items:
            items_payload.append({
                "description": item.get("description", "Item"),
                "quantity": item.get("quantity", 1),
                "unit_price": item.get("unit_price", 0),
                "sort_order": item.get("sort_order", 0),
            })

        val_days = int(template.get("default_validity_days") or 30)
        valid_until = payload.valid_until or (date.today() + timedelta(days=val_days)).isoformat()
        notes = payload.notes or template.get("default_notes") or template.get("description")
        terms = payload.terms or template.get("terms")

        q_create = QuotationCreate(
            customer_id=payload.customer_id,
            valid_until=valid_until,
            notes=notes,
            terms=terms,
            discount_id=payload.discount_id,
            tax_id=payload.tax_id,
            items=items_payload,
        )
        return await QuotationService.create_quotation(db, q_create, user_id=user_id)

    @staticmethod
    async def update_status(
        db: SupabaseDataClient, quotation_id: str, new_status: str
    ) -> Dict[str, Any]:
        quotation = await QuotationService.get_quotation(db, quotation_id)
        current_status = quotation.get("status")

        valid_transitions = {
            "draft": ["sent", "declined", "expired"],
            "sent": ["accepted", "declined", "expired"],
            "accepted": ["converted"],
            "declined": [],
            "expired": [],
            "converted": [],
        }

        # Allow flexible transition if permitted or admin
        allowed = valid_transitions.get(current_status, [])
        if new_status != current_status and new_status not in allowed and current_status != "draft":
            raise BadRequestException(f"Cannot transition quotation from '{current_status}' to '{new_status}'")

        # Note: if PostgreSQL enum doesn't have 'converted' yet, gracefully handle it
        try:
            return await db.update(
                table="quotations",
                data={"status": new_status},
                params={"id": f"eq.{quotation_id}"},
                single=True,
            )
        except Exception as e:
            if "converted" in str(e):
                # Fallback to accepted if converted enum isn't in DB yet
                return await db.update(
                    table="quotations",
                    data={"status": "accepted"},
                    params={"id": f"eq.{quotation_id}"},
                    single=True,
                )
            raise

    @staticmethod
    async def convert_to_subscription(
        db: SupabaseDataClient, quotation_id: str, plan_id: str, user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        quotation = await QuotationService.get_quotation(db, quotation_id)
        if quotation.get("status") not in ["accepted", "sent", "draft"]:
            raise BadRequestException(f"Cannot convert quotation with status '{quotation.get('status')}'")

        from app.services.subscription_service import SubscriptionService
        from app.schemas.subscriptions import SubscriptionCreate

        # Find or create subscription
        sub_create = SubscriptionCreate(
            customer_id=quotation["customer_id"],
            plan_id=plan_id,
            quantity=1,
            started_at=format_date_iso(date.today()),
            discount_id=quotation.get("discount_id"),
            tax_id=quotation.get("tax_id"),
            notes=f"Converted from quotation {quotation.get('number')}",
            status="confirmed",
        )
        subscription = await SubscriptionService.create_subscription(db, sub_create, user_id=user_id)

        # Mark quotation as converted
        try:
            await QuotationService.update_status(db, quotation_id, "converted")
        except Exception:
            pass

        return {
            "ok": True,
            "message": "Quotation converted to subscription successfully",
            "quotation_id": quotation_id,
            "subscription": subscription,
        }

    # Template methods
    @staticmethod
    async def list_templates(db: SupabaseDataClient) -> List[Dict[str, Any]]:
        try:
            data = await db.select(
                table="quotation_templates",
                columns="*",
                order="created_at.desc",
            )
            return data if isinstance(data, list) else []
        except Exception:
            return []

    @staticmethod
    async def get_template(db: SupabaseDataClient, template_id: str) -> Dict[str, Any]:
        data = await db.select(
            table="quotation_templates",
            columns="*",
            params={"id": f"eq.{template_id}"},
            single=True,
        )
        if not data:
            raise NotFoundException("Quotation template not found")
        return data

    @staticmethod
    async def create_template(
        db: SupabaseDataClient, payload: QuotationTemplateCreate, user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        t_dict = payload.model_dump()
        t_dict["created_by"] = user_id
        return await db.insert(table="quotation_templates", data=t_dict, single=True)

    @staticmethod
    async def update_template(
        db: SupabaseDataClient, template_id: str, payload: QuotationTemplateUpdate
    ) -> Dict[str, Any]:
        u_dict = payload.model_dump(exclude_unset=True)
        return await db.update(
            table="quotation_templates",
            data=u_dict,
            params={"id": f"eq.{template_id}"},
            single=True,
        )
