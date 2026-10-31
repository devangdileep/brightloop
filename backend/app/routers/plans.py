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
from app.schemas.plans import PlanCreate, PlanResponse, PlanUpdate
from app.services.plan_service import PlanService
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/plans", tags=["Plans"])


@router.get("", response_model=PaginatedResponse[PlanResponse])
async def list_plans(
    params: PaginationParams = Depends(),
    is_active: Optional[bool] = None,
    product_id: Optional[str] = None,
    interval: Optional[str] = None,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    data, total = await PlanService.list_plans(
        db, params=params, is_active=is_active, product_id=product_id, interval=interval
    )
    items = [PlanResponse(**p) for p in data]
    return PaginatedResponse.create(items=items, total=total, params=params)


@router.get("/{plan_id}", response_model=PlanResponse)
async def get_plan(
    plan_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    data = await PlanService.get_plan(db, plan_id)
    return PlanResponse(**data)


@router.post("", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: PlanCreate,
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    created = await PlanService.create_plan(db, payload)
    return PlanResponse(**created)


@router.put("/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: str,
    payload: PlanUpdate,
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    updated = await PlanService.update_plan(db, plan_id, payload)
    return PlanResponse(**updated)


@router.delete("/{plan_id}", response_model=SuccessResponse)
async def deactivate_plan(
    plan_id: str,
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    await PlanService.deactivate_plan(db, plan_id)
    return SuccessResponse(ok=True, message="Plan deactivated")
