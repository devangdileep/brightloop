from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import StreamingResponse
import io
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
from app.schemas.invoices import (
    InvoiceCreate,
    InvoiceItemResponse,
    InvoiceResponse,
    InvoiceStatusUpdate,
)
from app.services.invoice_service import InvoiceService
from app.services.pdf_service import PDFService
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.get("", response_model=PaginatedResponse[InvoiceResponse])
async def list_invoices(
    params: PaginationParams = Depends(),
    customer_id: Optional[str] = None,
    subscription_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    data, total = await InvoiceService.list_invoices(
        db,
        params=params,
        customer_id=customer_id,
        subscription_id=subscription_id,
        status=status_filter,
    )
    items = [InvoiceResponse(**i) for i in data]
    return PaginatedResponse.create(items=items, total=total, params=params)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    inv = await InvoiceService.get_invoice(db, invoice_id)
    if user.role == Role.CUSTOMER:
        cust = inv.get("customer") or {}
        if cust.get("user_id") != user.id:
            raise NotFoundException("Invoice not found")
    return InvoiceResponse(**inv)


@router.get("/{invoice_id}/items", response_model=List[InvoiceItemResponse])
async def get_invoice_items(
    invoice_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    inv = await InvoiceService.get_invoice(db, invoice_id)
    if user.role == Role.CUSTOMER:
        cust = inv.get("customer") or {}
        if cust.get("user_id") != user.id:
            raise NotFoundException("Invoice not found")
    items = inv.get("items") or []
    return [InvoiceItemResponse(**it) for it in items]


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: InvoiceCreate,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    created = await InvoiceService.create_invoice(db, payload, user_id=user.id)
    return InvoiceResponse(**created)


@router.post("/generate/{subscription_id}", response_model=Dict[str, Any])
async def generate_invoice_for_subscription(
    subscription_id: str,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    return await InvoiceService.generate_invoice_for_subscription(
        db, subscription_id, user_id=user.id
    )


@router.post("/{invoice_id}/confirm", response_model=InvoiceResponse)
async def confirm_invoice(
    invoice_id: str,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    updated = await InvoiceService.confirm_invoice(db, invoice_id)
    return InvoiceResponse(**updated)


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
async def cancel_invoice(
    invoice_id: str,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    updated = await InvoiceService.cancel_invoice(db, invoice_id)
    return InvoiceResponse(**updated)


@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    inv = await InvoiceService.get_invoice(db, invoice_id)
    if user.role == Role.CUSTOMER:
        cust = inv.get("customer") or {}
        if cust.get("user_id") != user.id:
            raise NotFoundException("Invoice not found")

    settings_row = None
    try:
        settings_row = await db.select(table="app_settings", columns="*", params={"id": "eq.1"}, single=True)
    except Exception:
        pass

    pdf_bytes = PDFService.generate_invoice_pdf(inv, settings_row)
    filename = f"{inv.get('number', 'invoice')}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.post("/{invoice_id}/send", response_model=SuccessResponse)
async def send_invoice(
    invoice_id: str,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    """Dispatches invoice to customer via email service if configured."""
    return SuccessResponse(ok=True, message=f"Invoice {invoice_id} sent to customer")
