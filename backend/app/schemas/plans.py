from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field


class PlanBase(BaseModel):
    product_id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    price: Decimal = Field(default=Decimal("0.00"), ge=0)
    interval: str = Field(default="monthly", pattern="^(daily|weekly|monthly|quarterly|yearly)$")
    interval_count: int = Field(default=1, ge=1, le=36)
    trial_days: int = Field(default=0, ge=0, le=365)
    features: Optional[List[str]] = None
    is_active: bool = True
    min_quantity: int = Field(default=1, ge=1)
    allow_pause: bool = True
    allow_early_closure: bool = True
    allow_renewal: bool = True
    auto_closure: bool = False


class PlanCreate(PlanBase):
    pass


class PlanUpdate(BaseModel):
    product_id: Optional[str] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    description: Optional[str] = None
    price: Optional[Decimal] = Field(default=None, ge=0)
    interval: Optional[str] = Field(default=None, pattern="^(daily|weekly|monthly|quarterly|yearly)$")
    interval_count: Optional[int] = Field(default=None, ge=1, le=36)
    trial_days: Optional[int] = Field(default=None, ge=0, le=365)
    features: Optional[List[str]] = None
    is_active: Optional[bool] = None
    min_quantity: Optional[int] = Field(default=None, ge=1)
    allow_pause: Optional[bool] = None
    allow_early_closure: Optional[bool] = None
    allow_renewal: Optional[bool] = None
    auto_closure: Optional[bool] = None


class PlanResponse(PlanBase):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
