from decimal import Decimal
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class PaymentCreate(BaseModel):
    invoice_id: str
    amount: Decimal = Field(..., gt=0)
    method: str = Field(default="card", pattern="^(card|bank_transfer|cash|upi|other)$")
    reference: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: str
    invoice_id: Optional[str] = None
    customer_id: str
    amount: Decimal
    method: str
    reference: Optional[str] = None
    paid_at: str
    notes: Optional[str] = None
    recorded_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    invoice: Optional[Dict[str, Any]] = None
    customer: Optional[Dict[str, Any]] = None


class PaymentWithInvoiceResponse(BaseModel):
    payment: PaymentResponse
    updated_invoice: Dict[str, Any]
