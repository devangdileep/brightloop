from fastapi import APIRouter, Depends, Query
from app.core.security import AuthenticatedUser
from app.database.supabase_client import SupabaseDataClient
from app.dependencies.authentication import RequireAdmin, get_db_client
from app.schemas.common import SuccessResponse
from app.schemas.products import ProductVariantResponse, ProductVariantUpdate
from app.services.product_service import ProductService

router = APIRouter(prefix="/variants", tags=["Variants"])


@router.put("/{variant_id}", response_model=ProductVariantResponse)
async def update_variant(
    variant_id: str,
    payload: ProductVariantUpdate,
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    updated = await ProductService.update_variant(db, variant_id, payload)
    return ProductVariantResponse(**updated)


@router.delete("/{variant_id}", response_model=SuccessResponse)
async def delete_variant(
    variant_id: str,
    hard_delete: bool = Query(default=False),
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    res = await ProductService.delete_or_deactivate_variant(db, variant_id, hard_delete=hard_delete)
    return SuccessResponse(ok=True, message=res.get("message"))
