from typing import List, Optional
from fastapi import APIRouter, Depends
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.permissions import Role
from app.core.security import AuthenticatedUser
from app.database.supabase_client import SupabaseDataClient
from app.dependencies.authentication import (
    RequireAdmin,
    RequireAuthenticated,
    RequireStaff,
    get_db_client,
)
from app.schemas.auth import ProfileResponse
from app.schemas.common import SuccessResponse
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/profiles", tags=["Profiles"])


@router.get("", response_model=PaginatedResponse[ProfileResponse])
async def list_profiles(
    params: PaginationParams = Depends(),
    role: Optional[Role] = None,
    admin_user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    filters = {}
    if role:
        filters["role"] = f"eq.{role.value}"

    data, total = await db.select(
        table="profiles",
        columns="*",
        params=filters,
        order="created_at.desc",
        limit=params.limit,
        offset=params.offset,
        count="exact",
    )
    items = [ProfileResponse(**p) for p in data]
    return PaginatedResponse.create(items=items, total=total, params=params)


@router.get("/{user_id}", response_model=ProfileResponse)
async def get_profile(
    user_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    if user.role == Role.CUSTOMER and user.id != user_id:
        raise NotFoundException("Profile not found")

    profile = await db.select(
        table="profiles",
        columns="*",
        params={"id": f"eq.{user_id}"},
        single=True,
    )
    if not profile:
        raise NotFoundException("Profile not found")
    return ProfileResponse(**profile)


@router.put("/{user_id}/role", response_model=SuccessResponse)
async def update_user_role(
    user_id: str,
    role: Role,
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    if admin_user.id == user_id:
        raise BadRequestException("You cannot change your own role")

    await db.update(
        table="profiles",
        data={"role": role.value},
        params={"id": f"eq.{user_id}"},
        single=True,
    )
    return SuccessResponse(ok=True, message=f"User role updated to {role.value}")
