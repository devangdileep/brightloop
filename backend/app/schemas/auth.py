from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from app.core.permissions import Role


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: Role


class ProfileResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: Role
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=30)
    avatar_url: Optional[str] = None


class StaffInviteRequest(BaseModel):
    email: EmailStr
    full_name: Optional[str] = Field(default=None, max_length=120)
    role: Role = Role.STAFF


class StaffInviteResponse(BaseModel):
    ok: bool = True
    message: str
    email: str
    role: Role
    user_id: Optional[str] = None
