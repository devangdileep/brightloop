from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SubscriptionLineBase(BaseModel):
    product_id: Optional[str] = None
    plan_id: Optional[str] = None
    description: str = Field(..., min_length=1)
    quantity: Decimal = Field(default=Decimal("1.00"), gt=0)
    unit_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    sort_order: int = 0


class SubscriptionLineCreate(SubscriptionLineBase):
    pass


class SubscriptionLineResponse(SubscriptionLineBase):
    id: str
    subscription_id: str
    amount: Decimal
    created_at: Optional[str] = None


class SubscriptionBase(BaseModel):
    customer_id: str
    plan_id: str
    quantity: int = Field(default=1, ge=1)
    started_at: Optional[str] = None
    discount_id: Optional[str] = None
    tax_id: Optional[str] = None
    notes: Optional[str] = None


class SubscriptionCreate(SubscriptionBase):
    status: Optional[str] = Field(
        default="active",
        pattern="^(draft|quotation|confirmed|active|trialing|paused|past_due|closed|canceled)$",
    )
    lines: Optional[List[SubscriptionLineCreate]] = None


class SubscriptionUpdate(BaseModel):
    plan_id: Optional[str] = None
    quantity: Optional[int] = Field(default=None, ge=1)
    notes: Optional[str] = None
    discount_id: Optional[str] = None
    tax_id: Optional[str] = None
    cancel_at_period_end: Optional[bool] = None


class SubscriptionStatusTransition(BaseModel):
    status: str = Field(
        ...,
        pattern="^(draft|quotation|confirmed|active|trialing|paused|past_due|closed|canceled)$",
    )
    reason: Optional[str] = None


class SubscriptionEventResponse(BaseModel):
    id: str
    subscription_id: str
    event_type: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_by: Optional[str] = None
    created_at: Optional[str] = None


class SubscriptionResponse(SubscriptionBase):
    id: str
    status: str
    current_period_start: str
    current_period_end: str
    trial_end: Optional[str] = None
    canceled_at: Optional[str] = None
    cancel_at_period_end: bool = False
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    lines: Optional[List[SubscriptionLineResponse]] = None
    plan: Optional[Dict[str, Any]] = None
    customer: Optional[Dict[str, Any]] = None
