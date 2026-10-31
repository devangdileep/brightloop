from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class AppSettingsBase(BaseModel):
    company_name: str = Field(default="Brightloop Software", max_length=150)
    support_email: EmailStr = Field(default="billing@brightloop.io")
    currency: str = Field(default="USD", max_length=10)
    invoice_prefix: str = Field(default="INV", max_length=20)
    invoice_due_days: int = Field(default=14, ge=1, le=180)
    default_tax_id: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None


class AppSettingsUpdate(BaseModel):
    company_name: Optional[str] = Field(default=None, max_length=150)
    support_email: Optional[EmailStr] = None
    currency: Optional[str] = Field(default=None, max_length=10)
    invoice_prefix: Optional[str] = Field(default=None, max_length=20)
    invoice_due_days: Optional[int] = Field(default=None, ge=1, le=180)
    default_tax_id: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None


class AppSettingsResponse(AppSettingsBase):
    id: int = 1
    updated_at: Optional[str] = None
