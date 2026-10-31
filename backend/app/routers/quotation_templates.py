from typing import List
from fastapi import APIRouter, Depends, status
from app.core.security import AuthenticatedUser
from app.database.supabase_client import SupabaseDataClient
from app.dependencies.authentication import (
    RequireAuthenticated,
    RequireStaff,
    get_db_client,
)
from app.schemas.quotations import (
    QuotationTemplateCreate,
    QuotationTemplateResponse,
    QuotationTemplateUpdate,
)
from app.services.quotation_service import QuotationService

router = APIRouter(prefix="/quotation-templates", tags=["Quotation Templates"])


@router.get("", response_model=List[QuotationTemplateResponse])
async def list_templates(
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    templates = await QuotationService.list_templates(db)
    return [QuotationTemplateResponse(**t) for t in templates]


@router.get("/{template_id}", response_model=QuotationTemplateResponse)
async def get_template(
    template_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    template = await QuotationService.get_template(db, template_id)
    return QuotationTemplateResponse(**template)


@router.post("", response_model=QuotationTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: QuotationTemplateCreate,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    created = await QuotationService.create_template(db, payload, user_id=user.id)
    return QuotationTemplateResponse(**created)


@router.put("/{template_id}", response_model=QuotationTemplateResponse)
async def update_template(
    template_id: str,
    payload: QuotationTemplateUpdate,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    updated = await QuotationService.update_template(db, template_id, payload)
    return QuotationTemplateResponse(**updated)
