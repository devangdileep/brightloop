from typing import Optional
from fastapi import APIRouter, Depends, status
from app.core.exceptions import NotFoundException
from app.core.security import AuthenticatedUser
from app.database.supabase_client import SupabaseDataClient
from app.dependencies.authentication import (
    RequireAdmin,
    RequireAuthenticated,
    get_db_client,
)
from app.schemas.common import SuccessResponse
from app.schemas.taxes import TaxCreate, TaxResponse, TaxUpdate
from app.services.tax_service import TaxService
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/taxes", tags=["Taxes"])


@router.get("/default", response_model=TaxResponse)
async def get_default_tax(
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    default_tax = await TaxService.get_default_tax(db)
    if not default_tax:
        raise NotFoundException("No default tax rate configured")
    return TaxResponse(**default_tax)


@router.get("", response_model=PaginatedResponse[TaxResponse])
async def list_taxes(
    params: PaginationParams = Depends(),
    is_active: Optional[bool] = None,
    country: Optional[str] = None,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    data, total = await TaxService.list_taxes(
        db, params=params, is_active=is_active, country=country
    )
    items = [TaxResponse(**t) for t in data]
    return PaginatedResponse.create(items=items, total=total, params=params)


@router.get("/{tax_id}", response_model=TaxResponse)
async def get_tax(
    tax_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    data = await TaxService.get_tax(db, tax_id)
    return TaxResponse(**data)


@router.post("", response_model=TaxResponse, status_code=status.HTTP_201_CREATED)
async def create_tax(
    payload: TaxCreate,
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    created = await TaxService.create_tax(db, payload)
    return TaxResponse(**created)


@router.put("/{tax_id}", response_model=TaxResponse)
async def update_tax(
    tax_id: str,
    payload: TaxUpdate,
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    updated = await TaxService.update_tax(db, tax_id, payload)
    return TaxResponse(**updated)


@router.delete("/{tax_id}", response_model=SuccessResponse)
async def deactivate_tax(
    tax_id: str,
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    await TaxService.deactivate_tax(db, tax_id)
    return SuccessResponse(ok=True, message="Tax rate deactivated")
