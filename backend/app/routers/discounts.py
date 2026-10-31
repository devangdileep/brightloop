from typing import Optional
from fastapi import APIRouter, Depends, status
from app.core.security import AuthenticatedUser
from app.database.supabase_client import SupabaseDataClient
from app.dependencies.authentication import (
    RequireAdmin,
    RequireAuthenticated,
    get_db_client,
)
from app.schemas.common import SuccessResponse
from app.schemas.discounts import (
    DiscountCreate,
    DiscountResponse,
    DiscountUpdate,
    DiscountValidationRequest,
    DiscountValidationResponse,
)
from app.services.discount_service import DiscountService
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/discounts", tags=["Discounts"])


@router.post("/validate", response_model=DiscountValidationResponse)
async def validate_discount(
    payload: DiscountValidationRequest,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    return await DiscountService.validate_discount(db, payload)


@router.get("", response_model=PaginatedResponse[DiscountResponse])
async def list_discounts(
    params: PaginationParams = Depends(),
    is_active: Optional[bool] = None,
    discount_type: Optional[str] = None,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    data, total = await DiscountService.list_discounts(
        db, params=params, is_active=is_active, discount_type=discount_type
    )
    items = [DiscountResponse(**d) for d in data]
    return PaginatedResponse.create(items=items, total=total, params=params)


@router.get("/{discount_id}", response_model=DiscountResponse)
async def get_discount(
    discount_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    data = await DiscountService.get_discount(db, discount_id)
    return DiscountResponse(**data)


@router.post("", response_model=DiscountResponse, status_code=status.HTTP_201_CREATED)
async def create_discount(
    payload: DiscountCreate,
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    created = await DiscountService.create_discount(db, payload)
    return DiscountResponse(**created)


@router.put("/{discount_id}", response_model=DiscountResponse)
async def update_discount(
    discount_id: str,
    payload: DiscountUpdate,
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    updated = await DiscountService.update_discount(db, discount_id, payload)
    return DiscountResponse(**updated)


@router.delete("/{discount_id}", response_model=SuccessResponse)
async def deactivate_discount(
    discount_id: str,
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    await DiscountService.update_discount(
        db, discount_id, DiscountUpdate(is_active=False)
    )
    return SuccessResponse(ok=True, message="Discount deactivated")
