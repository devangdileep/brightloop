from decimal import Decimal
from typing import List, Optional
from pydantic import AliasChoices, BaseModel, Field


class DiscountBase(BaseModel):
    code: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None
    type: str = Field(default="percentage", pattern="^(percentage|fixed)$")
    value: Decimal = Field(..., ge=0)
    is_active: bool = True
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    max_redemptions: Optional[int] = Field(default=None, ge=1)
    min_purchase: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0)
    min_quantity: Optional[int] = Field(default=1, ge=1)
    applicable_product_ids: Optional[List[str]] = None


class DiscountCreate(DiscountBase):
    pass


class DiscountUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=2, max_length=50)
    description: Optional[str] = None
    type: Optional[str] = Field(default=None, pattern="^(percentage|fixed)$")
    value: Optional[Decimal] = Field(default=None, ge=0)
    is_active: Optional[bool] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    max_redemptions: Optional[int] = Field(default=None, ge=1)
    min_purchase: Optional[Decimal] = Field(default=None, ge=0)
    min_quantity: Optional[int] = Field(default=None, ge=1)
    applicable_product_ids: Optional[List[str]] = None


class DiscountResponse(DiscountBase):
    id: str
    times_redeemed: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class DiscountValidationRequest(BaseModel):
    code: str
    subtotal: Decimal = Field(..., ge=0)
    quantity: int = Field(default=1, ge=1)
    product_id: Optional[str] = None


class DiscountValidationResponse(BaseModel):
    valid: bool
    reason: Optional[str] = None
    discount_amount: Decimal = Decimal("0.00")
    discount: Optional[DiscountResponse] = None


class DiscountUsageRecord(BaseModel):
    id: str
    discount_id: str
    customer_id: Optional[str] = None
    subscription_id: Optional[str] = None
    invoice_id: Optional[str] = None
    discount_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    applied_at: str
