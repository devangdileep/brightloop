from fastapi import APIRouter, Depends, status
import httpx
from app.core.config import settings
from app.core.exceptions import AppException, BadRequestException, ForbiddenException
from app.core.permissions import ADMIN_ONLY, Role
from app.core.security import AuthenticatedUser
from app.database.supabase_client import SupabaseDataClient, get_admin_db_client
from app.dependencies.authentication import (
    RequireAdmin,
    RequireAuthenticated,
    get_current_user,
    get_db_client,
)
from app.schemas.auth import (
    ProfileResponse,
    ProfileUpdateRequest,
    StaffInviteRequest,
    StaffInviteResponse,
    UserResponse,
)

router = APIRouter(tags=["Authentication & Profiles"])


@router.get("/me", response_model=UserResponse)
async def get_me(user: AuthenticatedUser = RequireAuthenticated):
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
    )


@router.get("/me/profile", response_model=ProfileResponse)
async def get_my_profile(
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    profile = await db.select(
        table="profiles",
        columns="*",
        params={"id": f"eq.{user.id}"},
        single=True,
    )
    return ProfileResponse(
        id=user.id,
        email=user.email,
        full_name=profile.get("full_name") or user.full_name,
        role=user.role,
        avatar_url=profile.get("avatar_url"),
        phone=profile.get("phone"),
        created_at=profile.get("created_at"),
        updated_at=profile.get("updated_at"),
    )


@router.put("/me/profile", response_model=ProfileResponse)
async def update_my_profile(
    payload: ProfileUpdateRequest,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return await get_my_profile(user=user, db=db)

    # Do not allow updating role through this endpoint
    update_data.pop("role", None)

    updated = await db.update(
        table="profiles",
        data=update_data,
        params={"id": f"eq.{user.id}"},
        single=True,
    )

    return ProfileResponse(
        id=user.id,
        email=user.email,
        full_name=updated.get("full_name"),
        role=user.role,
        avatar_url=updated.get("avatar_url"),
        phone=updated.get("phone"),
        created_at=updated.get("created_at"),
        updated_at=updated.get("updated_at"),
    )


@router.post("/auth/invite-staff", response_model=StaffInviteResponse, status_code=status.HTTP_201_CREATED)
async def invite_staff_member(
    payload: StaffInviteRequest,
    admin_user: AuthenticatedUser = RequireAdmin,
):
    """
    Admin-only staff account creation/invitation.
    Invites a user via Supabase Auth Admin API and sets their role to staff.
    """
    if payload.role not in (Role.STAFF, Role.ADMIN):
        raise BadRequestException("Can only invite staff or admin accounts")

    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise AppException(
            status_code=500,
            detail="Staff invitation requires SUPABASE_SERVICE_ROLE_KEY configured on server",
            error_code="CONFIGURATION_ERROR",
        )

    # 1. Use Supabase Auth Admin API to invite user by email
    invite_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/invite"
    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "email": payload.email,
        "data": {
            "full_name": payload.full_name or payload.email.split("@")[0],
            "role": payload.role.value,
        },
    }

    user_id = None
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(invite_url, json=body, headers=headers)
        if resp.status_code in (200, 201):
            invited_data = resp.json()
            user_id = invited_data.get("id")
        else:
            # If already registered, find user by email and update role
            admin_db = get_admin_db_client()
            existing_profiles = await admin_db.select(
                table="profiles",
                columns="id, email",
                params={"email": f"eq.{payload.email}"},
            )
            if existing_profiles and len(existing_profiles) > 0:
                user_id = existing_profiles[0]["id"]
            else:
                raise AppException(
                    status_code=resp.status_code,
                    detail=f"Failed to invite staff member: {resp.text}",
                    error_code="INVITE_ERROR",
                )

    # 2. Update role in public.profiles to staff
    if user_id:
        admin_db = get_admin_db_client()
        await admin_db.update(
            table="profiles",
            data={
                "role": payload.role.value,
                "full_name": payload.full_name or payload.email.split("@")[0],
            },
            params={"id": f"eq.{user_id}"},
            single=True,
        )

    return StaffInviteResponse(
        ok=True,
        message=f"Staff invitation sent to {payload.email}",
        email=payload.email,
        role=payload.role,
        user_id=user_id,
    )
