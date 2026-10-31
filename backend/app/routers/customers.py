from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, status
from app.core.exceptions import ForbiddenException, NotFoundException
from app.core.permissions import Role
from app.core.security import AuthenticatedUser
from app.database.supabase_client import SupabaseDataClient
from app.dependencies.authentication import (
    RequireAuthenticated,
    RequireStaff,
    get_db_client,
)
from app.schemas.customers import CustomerCreate, CustomerResponse, CustomerUpdate
from app.services.customer_service import CustomerService
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("/me", response_model=CustomerResponse)
async def get_current_customer(
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    """Returns the customer record corresponding to the currently logged in user."""
    customer = await CustomerService.get_customer_by_user_id(db, user.id)
    if not customer:
        raise NotFoundException("No customer profile linked to your user account")
    return CustomerResponse(**customer)


@router.get("", response_model=PaginatedResponse[CustomerResponse])
async def list_customers(
    params: PaginationParams = Depends(),
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    # If customer, PostgREST RLS will automatically restrict to user_id = auth.uid()
    data, total = await CustomerService.list_customers(
        db, params=params, status=status_filter, search=search
    )
    items = [CustomerResponse(**c) for c in data]
    return PaginatedResponse.create(items=items, total=total, params=params)


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    customer = await CustomerService.get_customer(db, customer_id)
    if user.role == Role.CUSTOMER and customer.get("user_id") != user.id:
        raise NotFoundException("Customer not found")
    return CustomerResponse(**customer)


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    created = await CustomerService.create_customer(db, payload)
    return CustomerResponse(**created)


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    updated = await CustomerService.update_customer(db, customer_id, payload)
    return CustomerResponse(**updated)


@router.get("/{customer_id}/subscriptions", response_model=List[Dict[str, Any]])
async def get_customer_subscriptions(
    customer_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    if user.role == Role.CUSTOMER:
        customer = await CustomerService.get_customer(db, customer_id)
        if customer.get("user_id") != user.id:
            raise NotFoundException("Customer not found")

    return await CustomerService.get_customer_subscriptions(db, customer_id)


@router.get("/{customer_id}/invoices", response_model=List[Dict[str, Any]])
async def get_customer_invoices(
    customer_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    if user.role == Role.CUSTOMER:
        customer = await CustomerService.get_customer(db, customer_id)
        if customer.get("user_id") != user.id:
            raise NotFoundException("Customer not found")

    return await CustomerService.get_customer_invoices(db, customer_id)
