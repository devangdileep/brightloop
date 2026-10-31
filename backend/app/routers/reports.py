from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.core.security import AuthenticatedUser
from app.database.supabase_client import SupabaseDataClient
from app.dependencies.authentication import RequireStaff, get_db_client
from app.schemas.dashboard import RevenueReportResponse
from app.services.report_service import ReportService
from app.utils.date_calculations import add_billing_interval, format_date_iso

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/revenue", response_model=RevenueReportResponse)
async def get_revenue_report(
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    today = date.today()
    e_date = end_date or format_date_iso(today)
    s_date = start_date or format_date_iso(add_billing_interval(today, "monthly", -6))

    report = await ReportService.get_revenue_report(db, start_date=s_date, end_date=e_date)
    return RevenueReportResponse(**report)
