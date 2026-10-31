from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, status
from app.core.exceptions import NotFoundException
from app.core.permissions import Role
from app.core.security import AuthenticatedUser
from app.database.supabase_client import SupabaseDataClient
from app.dependencies.authentication import (
    RequireAuthenticated,
    RequireStaff,
    get_db_client,
)
from app.schemas.common import SuccessResponse
from app.schemas.quotations import (
    QuotationCreate,
    QuotationCreateFromTemplate,
    QuotationResponse,
    QuotationStatusUpdate,
)
from app.services.quotation_service import QuotationService
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/quotations", tags=["Quotations"])


@router.get("", response_model=PaginatedResponse[QuotationResponse])
async def list_quotations(
    params: PaginationParams = Depends(),
    customer_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    data, total = await QuotationService.list_quotations(
        db, params=params, customer_id=customer_id, status=status_filter
    )
    items = [QuotationResponse(**q) for q in data]
    return PaginatedResponse.create(items=items, total=total, params=params)


@router.get("/{quotation_id}", response_model=QuotationResponse)
async def get_quotation(
    quotation_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    quotation = await QuotationService.get_quotation(db, quotation_id)
    if user.role == Role.CUSTOMER:
        customer = quotation.get("customer") or {}
        if customer.get("user_id") != user.id:
            raise NotFoundException("Quotation not found")
    return QuotationResponse(**quotation)


@router.post("", response_model=QuotationResponse, status_code=status.HTTP_201_CREATED)
async def create_quotation(
    payload: QuotationCreate,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    created = await QuotationService.create_quotation(db, payload, user_id=user.id)
    return QuotationResponse(**created)


@router.post("/from-template", response_model=QuotationResponse, status_code=status.HTTP_201_CREATED)
async def create_quotation_from_template(
    payload: QuotationCreateFromTemplate,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    created = await QuotationService.create_from_template(db, payload, user_id=user.id)
    return QuotationResponse(**created)


@router.put("/{quotation_id}/status", response_model=QuotationResponse)
async def update_quotation_status(
    quotation_id: str,
    payload: QuotationStatusUpdate,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    updated = await QuotationService.update_status(db, quotation_id, payload.status)
    return QuotationResponse(**updated)


@router.post("/{quotation_id}/convert", response_model=Dict[str, Any])
async def convert_quotation_to_subscription(
    quotation_id: str,
    plan_id: str,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    return await QuotationService.convert_to_subscription(
        db, quotation_id, plan_id=plan_id, user_id=user.id
    )


@router.post("/{quotation_id}/send", response_model=SuccessResponse)
async def send_quotation(
    quotation_id: str,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    """Marks quotation as sent and optionally dispatches via email service."""
    await QuotationService.update_status(db, quotation_id, "sent")
    return SuccessResponse(ok=True, message=f"Quotation {quotation_id} marked as sent")
