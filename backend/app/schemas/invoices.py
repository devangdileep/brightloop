from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class InvoiceItemBase(BaseModel):
    description: str = Field(..., min_length=1)
    quantity: Decimal = Field(default=Decimal("1.00"), gt=0)
    unit_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    sort_order: int = 0


class InvoiceItemCreate(InvoiceItemBase):
    pass


class InvoiceItemResponse(InvoiceItemBase):
    id: str
    invoice_id: str
    amount: Decimal
    created_at: Optional[str] = None


class InvoiceBase(BaseModel):
    customer_id: str
    subscription_id: Optional[str] = None
    issue_date: Optional[str] = None
    due_date: Optional[str] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    currency: str = "USD"
    notes: Optional[str] = None


class InvoiceCreate(InvoiceBase):
    items: List[InvoiceItemCreate] = Field(..., min_length=1)
    discount_id: Optional[str] = None
    tax_id: Optional[str] = None


class InvoiceStatusUpdate(BaseModel):
    status: str = Field(
        ...,
        pattern="^(draft|open|confirmed|paid|partially_paid|overdue|void|cancelled|uncollectible)$",
    )


class InvoiceResponse(InvoiceBase):
    id: str
    number: str
    status: str
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    total: Decimal
    amount_paid: Decimal
    outstanding_balance: Decimal
    pdf_path: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    items: Optional[List[InvoiceItemResponse]] = None
    customer: Optional[Dict[str, Any]] = None
