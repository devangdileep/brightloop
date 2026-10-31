from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.database.supabase_client import SupabaseDataClient
from app.schemas.payments import PaymentCreate
from app.utils.pagination import PaginationParams


class PaymentService:
    @staticmethod
    async def list_payments(
        db: SupabaseDataClient,
        params: PaginationParams,
        customer_id: Optional[str] = None,
        invoice_id: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        filters: Dict[str, Any] = {}
        if customer_id:
            filters["customer_id"] = f"eq.{customer_id}"
        if invoice_id:
            filters["invoice_id"] = f"eq.{invoice_id}"

        data, total = await db.select(
            table="payments",
            columns="*, customer:customers(id, name), invoice:invoices(id, number)",
            params=filters,
            order="paid_at.desc",
            limit=params.limit,
            offset=params.offset,
            count="exact",
        )
        return data, total

    @staticmethod
    async def get_payment(db: SupabaseDataClient, payment_id: str) -> Dict[str, Any]:
        data = await db.select(
            table="payments",
            columns="*, customer:customers(*), invoice:invoices(*)",
            params={"id": f"eq.{payment_id}"},
            single=True,
        )
        if not data:
            raise NotFoundException("Payment record not found")
        return data

    @staticmethod
    async def record_payment(
        db: SupabaseDataClient, payload: PaymentCreate, user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        # Fetch invoice to validate outstanding balance & customer_id
        invoice = await db.select(
            table="invoices",
            columns="id, customer_id, total, amount_paid, status",
            params={"id": f"eq.{payload.invoice_id}"},
            single=True,
        )
        if not invoice:
            raise NotFoundException("Invoice not found")

        inv_total = Decimal(str(invoice.get("total", 0)))
        inv_paid = Decimal(str(invoice.get("amount_paid", 0)))
        outstanding = max(Decimal("0.00"), inv_total - inv_paid)

        payment_amount = Decimal(str(payload.amount))
        if payment_amount <= 0:
            raise BadRequestException("Payment amount must be greater than zero")

        if payment_amount > outstanding:
            raise BadRequestException(
                f"Payment amount (${payment_amount:,.2f}) exceeds outstanding balance (${outstanding:,.2f})"
            )

        # Idempotency check: prevent duplicate reference on this invoice
        if payload.reference:
            existing = await db.select(
                table="payments",
                columns="id",
                params={
                    "invoice_id": f"eq.{payload.invoice_id}",
                    "reference": f"eq.{payload.reference.strip()}",
                },
            )
            if existing and len(existing) > 0:
                raise ConflictException(
                    f"A payment with reference '{payload.reference.strip()}' has already been recorded for this invoice"
                )

        # Normalize payment method for database enum
        method = payload.method.lower()
        if method == "upi":
            # If DB enum hasn't been migrated with 'upi', 'other' is safe
            pass

        payment_data = {
            "invoice_id": payload.invoice_id,
            "customer_id": invoice["customer_id"],
            "amount": float(payment_amount),
            "method": method,
            "reference": payload.reference.strip() if payload.reference else None,
            "notes": payload.notes,
            "recorded_by": user_id,
        }

        try:
            created_payment = await db.insert(table="payments", data=payment_data, single=True)
        except Exception as e:
            if "upi" in str(e) and method == "upi":
                # Fallback to 'other' if upi enum is not present in unmigrated database
                payment_data["method"] = "other"
                created_payment = await db.insert(table="payments", data=payment_data, single=True)
            else:
                raise

        # Fetch updated invoice (sync_invoice_amount_paid trigger automatically updated it)
        updated_invoice = await db.select(
            table="invoices",
            columns="id, number, status, total, amount_paid, currency",
            params={"id": f"eq.{payload.invoice_id}"},
            single=True,
        )

        tot = Decimal(str(updated_invoice.get("total", 0)))
        paid = Decimal(str(updated_invoice.get("amount_paid", 0)))
        updated_invoice["outstanding_balance"] = float(max(Decimal("0.00"), tot - paid))

        return {
            "payment": created_payment,
            "updated_invoice": updated_invoice,
        }
