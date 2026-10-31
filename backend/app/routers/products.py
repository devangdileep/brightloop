from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from app.core.security import AuthenticatedUser
from app.database.supabase_client import SupabaseDataClient
from app.dependencies.authentication import (
    RequireAdmin,
    RequireAuthenticated,
    get_db_client,
)
from app.schemas.common import SuccessResponse
from app.schemas.products import (
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    ProductVariantCreate,
    ProductVariantResponse,
)
from app.services.product_service import ProductService
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=PaginatedResponse[ProductResponse])
async def list_products(
    params: PaginationParams = Depends(),
    is_active: Optional[bool] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    data, total = await ProductService.list_products(
        db, params=params, is_active=is_active, category=category, search=search
    )
    items = [ProductResponse(**p) for p in data]
    return PaginatedResponse.create(items=items, total=total, params=params)


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    data = await ProductService.get_product(db, product_id)
    return ProductResponse(**data)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    created = await ProductService.create_product(db, payload)
    return ProductResponse(**created)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    updated = await ProductService.update_product(db, product_id, payload)
    return ProductResponse(**updated)


@router.delete("/{product_id}", response_model=SuccessResponse)
async def delete_product(
    product_id: str,
    hard_delete: bool = Query(default=False),
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    res = await ProductService.delete_or_deactivate_product(db, product_id, hard_delete=hard_delete)
    return SuccessResponse(ok=True, message=res.get("message"))


# Product Variants sub-routes
@router.get("/{product_id}/variants", response_model=List[ProductVariantResponse])
async def get_product_variants(
    product_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    variants = await ProductService.list_variants(db, product_id)
    return [ProductVariantResponse(**v) for v in variants]


@router.post("/{product_id}/variants", response_model=ProductVariantResponse, status_code=status.HTTP_201_CREATED)
async def add_product_variant(
    product_id: str,
    payload: ProductVariantCreate,
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    created = await ProductService.add_variant(db, product_id, payload)
    return ProductVariantResponse(**created)
