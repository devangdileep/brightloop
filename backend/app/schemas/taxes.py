from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


class TaxBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    rate: Decimal = Field(..., ge=0, le=100)
    country: Optional[str] = Field(default=None, max_length=100)
    is_default: bool = False
    is_active: bool = True


class TaxCreate(TaxBase):
    pass


class TaxUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    rate: Optional[Decimal] = Field(default=None, ge=0, le=100)
    country: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class TaxResponse(TaxBase):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
