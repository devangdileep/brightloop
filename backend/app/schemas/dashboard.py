from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class DashboardMetricsResponse(BaseModel):
    active_subscriptions: int
    subscriptions_by_status: Dict[str, int]
    subscriptions_by_frequency: Dict[str, int]
    revenue_for_period: Decimal
    outstanding_invoices_amount: Decimal
    overdue_invoices_count: int
    paid_invoices_count: int
    partially_paid_invoices_count: int
    open_invoices_count: int
    recent_invoices: List[Dict[str, Any]]
    recent_payments: List[Dict[str, Any]]


class RevenueReportItem(BaseModel):
    date: str
    revenue: Decimal
    invoices_count: int
    payments_count: int


class RevenueReportResponse(BaseModel):
    start_date: str
    end_date: str
    total_revenue: Decimal
    total_invoiced: Decimal
    data: List[RevenueReportItem]
