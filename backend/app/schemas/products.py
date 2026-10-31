from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import AliasChoices, BaseModel, Field


class ProductVariantBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    sku: Optional[str] = Field(default=None, max_length=50)
    attributes: Optional[Dict[str, Any]] = Field(default_factory=dict)
    cost_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    price_modifier: Decimal = Field(default=Decimal("0.00"), description="Adjustment relative to base price")
    is_active: bool = True


class ProductVariantCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    sku: Optional[str] = Field(default=None, max_length=50)
    attributes: Optional[Dict[str, Any]] = Field(default_factory=dict)
    cost_price: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0)
    price_modifier: Decimal = Field(default=Decimal("0.00"), description="Adjustment relative to base price")
    is_active: bool = True


class ProductVariantUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    sku: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None
    cost_price: Optional[Decimal] = Field(default=None, ge=0)
    price_modifier: Optional[Decimal] = None
    is_active: Optional[bool] = None


class ProductVariantResponse(ProductVariantBase):
    id: str
    product_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    category: Optional[str] = None
    base_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    is_active: bool = True


class ProductCreate(ProductBase):
    variants: Optional[List[ProductVariantCreate]] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    description: Optional[str] = None
    category: Optional[str] = None
    base_price: Optional[Decimal] = Field(default=None, ge=0)
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    variants: Optional[List[ProductVariantResponse]] = None
