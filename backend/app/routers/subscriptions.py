from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
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
from app.schemas.subscriptions import (
    SubscriptionCreate,
    SubscriptionEventResponse,
    SubscriptionResponse,
    SubscriptionStatusTransition,
    SubscriptionUpdate,
)
from app.services.subscription_service import SubscriptionService
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


@router.get("", response_model=PaginatedResponse[SubscriptionResponse])
async def list_subscriptions(
    params: PaginationParams = Depends(),
    customer_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    plan_id: Optional[str] = None,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    data, total = await SubscriptionService.list_subscriptions(
        db, params=params, customer_id=customer_id, status=status_filter, plan_id=plan_id
    )
    items = [SubscriptionResponse(**s) for s in data]
    return PaginatedResponse.create(items=items, total=total, params=params)


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
async def get_subscription(
    subscription_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    sub = await SubscriptionService.get_subscription(db, subscription_id)
    if user.role == Role.CUSTOMER:
        customer = sub.get("customer") or {}
        if customer.get("user_id") != user.id:
            raise NotFoundException("Subscription not found")
    return SubscriptionResponse(**sub)


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    payload: SubscriptionCreate,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    created = await SubscriptionService.create_subscription(db, payload, user_id=user.id)
    return SubscriptionResponse(**created)


@router.put("/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: str,
    payload: SubscriptionUpdate,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    updated = await SubscriptionService.update_subscription(db, subscription_id, payload)
    return SubscriptionResponse(**updated)


@router.post("/{subscription_id}/pause", response_model=SubscriptionResponse)
async def pause_subscription(
    subscription_id: str,
    reason: Optional[str] = None,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    updated = await SubscriptionService.pause_subscription(db, subscription_id, reason=reason)
    return SubscriptionResponse(**updated)


@router.post("/{subscription_id}/resume", response_model=SubscriptionResponse)
async def resume_subscription(
    subscription_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    # Customer can resume their own subscription
    if user.role == Role.CUSTOMER:
        sub = await SubscriptionService.get_subscription(db, subscription_id)
        cust = sub.get("customer") or {}
        if cust.get("user_id") != user.id:
            raise NotFoundException("Subscription not found")

    updated = await SubscriptionService.resume_subscription(db, subscription_id)
    return SubscriptionResponse(**updated)


@router.post("/{subscription_id}/cancel", response_model=SubscriptionResponse)
async def cancel_subscription(
    subscription_id: str,
    immediate: bool = Query(default=False),
    reason: Optional[str] = None,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    # Customer can cancel their own subscription (only at period end if customer)
    if user.role == Role.CUSTOMER:
        sub = await SubscriptionService.get_subscription(db, subscription_id)
        cust = sub.get("customer") or {}
        if cust.get("user_id") != user.id:
            raise NotFoundException("Subscription not found")
        immediate = False  # Customers cancel at period end

    updated = await SubscriptionService.cancel_subscription(
        db, subscription_id, immediate=immediate, reason=reason
    )
    return SubscriptionResponse(**updated)


@router.post("/{subscription_id}/close", response_model=SubscriptionResponse)
async def close_subscription(
    subscription_id: str,
    reason: Optional[str] = None,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    updated = await SubscriptionService.close_subscription(db, subscription_id, reason=reason)
    return SubscriptionResponse(**updated)


@router.post("/{subscription_id}/renew", response_model=SubscriptionResponse)
async def renew_subscription(
    subscription_id: str,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    updated = await SubscriptionService.renew_subscription(db, subscription_id)
    return SubscriptionResponse(**updated)


@router.get("/{subscription_id}/events", response_model=List[SubscriptionEventResponse])
async def get_subscription_events(
    subscription_id: str,
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    if user.role == Role.CUSTOMER:
        sub = await SubscriptionService.get_subscription(db, subscription_id)
        cust = sub.get("customer") or {}
        if cust.get("user_id") != user.id:
            raise NotFoundException("Subscription not found")

    events = await SubscriptionService.get_subscription_events(db, subscription_id)
    return [SubscriptionEventResponse(**e) for e in events]
