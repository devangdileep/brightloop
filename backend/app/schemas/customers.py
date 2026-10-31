from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class CustomerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    company: Optional[str] = Field(default=None, max_length=150)
    contact_name: Optional[str] = Field(default=None, max_length=150)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=50)
    country: Optional[str] = Field(default=None, max_length=100)
    address: Optional[str] = None
    tax_id: Optional[str] = Field(default=None, max_length=100)
    status: str = Field(default="active", pattern="^(active|inactive)$")
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    user_id: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    company: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(active|inactive)$")
    notes: Optional[str] = None
    user_id: Optional[str] = None


class CustomerResponse(CustomerBase):
    id: str
    user_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
