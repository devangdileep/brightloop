from typing import List, Optional
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
from app.schemas.payments import PaymentCreate, PaymentResponse, PaymentWithInvoiceResponse
from app.services.payment_service import PaymentService
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("", response_model=PaginatedResponse[PaymentResponse])
async def list_payments(
    params: PaginationParams = Depends(),
    customer_id: Optional[str] = None,
    invoice_id: Optional[str] = None,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    data, total = await PaymentService.list_payments(
        db, params=params, customer_id=customer_id, invoice_id=invoice_id
    )
    items = [PaymentResponse(**p) for p in data]
    return PaginatedResponse.create(items=items, total=total, params=params)


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    payment = await PaymentService.get_payment(db, payment_id)
    if user.role == Role.CUSTOMER:
        customer = payment.get("customer") or {}
        if customer.get("user_id") != user.id:
            raise NotFoundException("Payment not found")
    return PaymentResponse(**payment)


@router.post("", response_model=PaymentWithInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def record_payment(
    payload: PaymentCreate,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    result = await PaymentService.record_payment(db, payload, user_id=user.id)
    return PaymentWithInvoiceResponse(
        payment=PaymentResponse(**result["payment"]),
        updated_invoice=result["updated_invoice"],
    )


@router.get("/invoice/{invoice_id}", response_model=List[PaymentResponse])
async def get_payments_for_invoice(
    invoice_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    data, _ = await PaymentService.list_payments(
        db, params=PaginationParams(page=1, page_size=100), invoice_id=invoice_id
    )
    return [PaymentResponse(**p) for p in data]


@router.get("/customer/{customer_id}", response_model=List[PaymentResponse])
async def get_payments_for_customer(
    customer_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    if user.role == Role.CUSTOMER:
        cust = await db.select(table="customers", columns="user_id", params={"id": f"eq.{customer_id}"}, single=True)
        if cust.get("user_id") != user.id:
            raise NotFoundException("Customer not found")

    data, _ = await PaymentService.list_payments(
        db, params=PaginationParams(page=1, page_size=100), customer_id=customer_id
    )
    return [PaymentResponse(**p) for p in data]
