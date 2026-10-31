from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Header
from app.core.config import settings
from app.core.exceptions import UnauthorizedException
from app.core.security import AuthenticatedUser
from app.database.supabase_client import SupabaseDataClient, get_admin_db_client
from app.dependencies.authentication import (
    RequireStaff,
    get_current_user,
    get_db_client,
)
from app.schemas.billing import BillingRunRequest, BillingRunResponse
from app.services.billing_service import BillingService
from app.utils.date_calculations import parse_date

router = APIRouter(prefix="/billing", tags=["Recurring Billing"])


@router.post("/run", response_model=BillingRunResponse)
async def trigger_billing_run(
    payload: Optional[BillingRunRequest] = None,
    authorization: Optional[str] = Header(None),
):
    """
    Triggers recurring billing run.
    Accepts:
    1. Admin / Staff Supabase JWT Bearer token OR
    2. BILLING_CRON_SECRET Bearer token (for automated cron / external scheduler).
    """
    is_cron_authorized = False
    req_token = ""
    if authorization and authorization.lower().startswith("bearer "):
        req_token = authorization.split(" ")[1]

    if settings.BILLING_CRON_SECRET and req_token == settings.BILLING_CRON_SECRET:
        is_cron_authorized = True

    target_date = None
    dry_run = False
    if payload:
        if payload.target_date:
            target_date = parse_date(payload.target_date)
        dry_run = payload.dry_run

    if is_cron_authorized:
        # Use privileged admin client for scheduled cron
        admin_db = get_admin_db_client()
        result = await BillingService.run_billing_cycle(
            db=admin_db, target_date=target_date, dry_run=dry_run
        )
        return BillingRunResponse(**result)

    # Otherwise verify user is staff/admin
    if not req_token:
        raise UnauthorizedException("Authentication token or cron secret required")

    user = await get_current_user(token=req_token)
    if user.role.value not in ("admin", "staff"):
        raise UnauthorizedException("Staff or admin privileges required to trigger billing")

    # Run with user db client or admin db client
    admin_db = get_admin_db_client() if settings.SUPABASE_SERVICE_ROLE_KEY else None
    result = await BillingService.run_billing_cycle(
        db=admin_db, target_date=target_date, dry_run=dry_run
    )
    return BillingRunResponse(**result)
