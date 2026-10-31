from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class QuotationItemBase(BaseModel):
    description: str = Field(..., min_length=1)
    quantity: Decimal = Field(default=Decimal("1.00"), gt=0)
    unit_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    sort_order: int = 0


class QuotationItemCreate(QuotationItemBase):
    pass


class QuotationItemResponse(QuotationItemBase):
    id: str
    quotation_id: str
    amount: Decimal
    created_at: Optional[str] = None


class QuotationBase(BaseModel):
    customer_id: str
    issue_date: Optional[str] = None
    valid_until: str
    notes: Optional[str] = None
    terms: Optional[str] = None
    discount_id: Optional[str] = None
    tax_id: Optional[str] = None


class QuotationCreate(QuotationBase):
    items: List[QuotationItemCreate] = Field(..., min_length=1)


class QuotationCreateFromTemplate(BaseModel):
    template_id: str
    customer_id: str
    valid_until: str
    notes: Optional[str] = None
    terms: Optional[str] = None
    discount_id: Optional[str] = None
    tax_id: Optional[str] = None


class QuotationStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(draft|sent|accepted|declined|expired|converted)$")


class QuotationResponse(QuotationBase):
    id: str
    number: str
    status: str
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    total: Decimal
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    items: Optional[List[QuotationItemResponse]] = None


class QuotationTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    items: List[Dict[str, Any]] = Field(default_factory=list)
    is_active: bool = True


class QuotationTemplateCreate(QuotationTemplateBase):
    pass


class QuotationTemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    description: Optional[str] = None
    items: Optional[List[Dict[str, Any]]] = None
    is_active: Optional[bool] = None


class QuotationTemplateResponse(QuotationTemplateBase):
    id: str
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
