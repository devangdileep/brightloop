from typing import Optional
from fastapi import APIRouter, Depends
from app.core.security import AuthenticatedUser
from app.database.supabase_client import SupabaseDataClient
from app.dependencies.authentication import RequireStaff, get_db_client
from app.schemas.dashboard import DashboardMetricsResponse
from app.services.report_service import ReportService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/metrics", response_model=DashboardMetricsResponse)
async def get_dashboard_metrics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: AuthenticatedUser = RequireStaff,
    db: SupabaseDataClient = Depends(get_db_client),
):
    metrics = await ReportService.get_dashboard_metrics(db, start_date=start_date, end_date=end_date)
    return DashboardMetricsResponse(**metrics)
