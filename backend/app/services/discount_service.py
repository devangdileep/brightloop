from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from app.core.exceptions import ConflictException, NotFoundException
from app.database.supabase_client import SupabaseDataClient
from app.schemas.discounts import (
    DiscountCreate,
    DiscountUpdate,
    DiscountValidationRequest,
    DiscountValidationResponse,
)
from app.utils.date_calculations import parse_date
from app.utils.pagination import PaginationParams


class DiscountService:
    @staticmethod
    async def list_discounts(
        db: SupabaseDataClient,
        params: PaginationParams,
        is_active: Optional[bool] = None,
        discount_type: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        filters: Dict[str, Any] = {}
        if is_active is not None:
            filters["is_active"] = f"eq.{str(is_active).lower()}"
        if discount_type:
            filters["type"] = f"eq.{discount_type}"

        data, total = await db.select(
            table="discounts",
            columns="*",
            params=filters,
            order="created_at.desc",
            limit=params.limit,
            offset=params.offset,
            count="exact",
        )
        return data, total

    @staticmethod
    async def get_discount(db: SupabaseDataClient, discount_id: str) -> Dict[str, Any]:
        data = await db.select(
            table="discounts",
            columns="*",
            params={"id": f"eq.{discount_id}"},
            single=True,
        )
        if not data:
            raise NotFoundException("Discount not found")
        return data

    @staticmethod
    async def get_discount_by_code(db: SupabaseDataClient, code: str) -> Optional[Dict[str, Any]]:
        try:
            data = await db.select(
                table="discounts",
                columns="*",
                params={"code": f"eq.{code.strip().upper()}"},
                single=True,
            )
            return data
        except Exception:
            return None

    @staticmethod
    async def create_discount(db: SupabaseDataClient, payload: DiscountCreate) -> Dict[str, Any]:
        code = payload.code.strip().upper()
        existing = await DiscountService.get_discount_by_code(db, code)
        if existing:
            raise ConflictException(f"Discount code '{code}' already exists")

        d_dict = payload.model_dump()
        d_dict["code"] = code
        d_dict["value"] = float(d_dict["value"])
        if d_dict.get("min_purchase") is not None:
            d_dict["min_purchase"] = float(d_dict["min_purchase"])

        # Filter out fields that might not be in the initial schema if unmigrated
        valid_keys = {
            "code", "description", "type", "value", "is_active",
            "valid_from", "valid_until", "max_redemptions"
        }
        filtered = {k: v for k, v in d_dict.items() if k in valid_keys and v is not None}
        return await db.insert(table="discounts", data=filtered, single=True)

    @staticmethod
    async def update_discount(
        db: SupabaseDataClient, discount_id: str, payload: DiscountUpdate
    ) -> Dict[str, Any]:
        update_data = payload.model_dump(exclude_unset=True)
        if "code" in update_data and update_data["code"]:
            update_data["code"] = update_data["code"].strip().upper()
        if "value" in update_data and update_data["value"] is not None:
            update_data["value"] = float(update_data["value"])

        if not update_data:
            return await DiscountService.get_discount(db, discount_id)

        valid_keys = {
            "code", "description", "type", "value", "is_active",
            "valid_from", "valid_until", "max_redemptions"
        }
        filtered = {k: v for k, v in update_data.items() if k in valid_keys}
        return await db.update(
            table="discounts",
            data=filtered,
            params={"id": f"eq.{discount_id}"},
            single=True,
        )

    @staticmethod
    async def validate_discount(
        db: SupabaseDataClient, payload: DiscountValidationRequest, today: Optional[date] = None
    ) -> DiscountValidationResponse:
        current_date = today or date.today()
        discount = await DiscountService.get_discount_by_code(db, payload.code)

        if not discount:
            return DiscountValidationResponse(valid=False, reason="Discount code does not exist")

        if not discount.get("is_active"):
            return DiscountValidationResponse(valid=False, reason="Discount code is not active")

        # Check date validity
        valid_from = discount.get("valid_from")
        if valid_from and parse_date(valid_from) > current_date:
            return DiscountValidationResponse(valid=False, reason="Discount is not yet valid")

        valid_until = discount.get("valid_until")
        if valid_until and parse_date(valid_until) < current_date:
            return DiscountValidationResponse(valid=False, reason="Discount has expired")

        # Check redemption limits
        max_redemptions = discount.get("max_redemptions")
        times_redeemed = discount.get("times_redeemed", 0)
        if max_redemptions is not None and times_redeemed >= max_redemptions:
            return DiscountValidationResponse(valid=False, reason="Discount usage limit has been reached")

        # Calculate discount amount
        subtotal = Decimal(str(payload.subtotal))
        d_type = discount.get("type", "percentage")
        d_val = Decimal(str(discount.get("value", 0)))

        if d_type == "percentage":
            discount_amount = round(subtotal * (d_val / Decimal("100")), 2)
        else:
            discount_amount = min(d_val, subtotal)

        return DiscountValidationResponse(
            valid=True,
            discount_amount=discount_amount,
            discount=discount,
        )

    @staticmethod
    async def record_redemption(
        db: SupabaseDataClient,
        discount_id: str,
        amount: Decimal,
        customer_id: Optional[str] = None,
        invoice_id: Optional[str] = None,
    ) -> None:
        discount = await DiscountService.get_discount(db, discount_id)
        current_times = int(discount.get("times_redeemed", 0))

        # Increment times_redeemed
        await db.update(
            table="discounts",
            data={"times_redeemed": current_times + 1},
            params={"id": f"eq.{discount_id}"},
            single=True,
        )

        # Optionally insert into discount_usage table
        try:
            await db.insert(
                table="discount_usage",
                data={
                    "discount_id": discount_id,
                    "customer_id": customer_id,
                    "invoice_id": invoice_id,
                    "amount": float(amount),
                },
                single=True,
            )
        except Exception:
            pass
