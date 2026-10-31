from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional
from app.database.supabase_client import SupabaseDataClient
from app.utils.date_calculations import format_date_iso, parse_date


class ReportService:
    @staticmethod
    async def get_dashboard_metrics(
        db: SupabaseDataClient,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Calculates high-level metrics for admin/staff dashboard.
        """
        today_str = format_date_iso(date.today())

        # 1. Active subscriptions count & subscriptions by status
        subscriptions = await db.select(
            table="subscriptions",
            columns="id, status, plan:plans(interval)",
        )
        subs_list = subscriptions if isinstance(subscriptions, list) else []

        active_subs = 0
        status_counts: Dict[str, int] = {}
        freq_counts: Dict[str, int] = {}

        for s in subs_list:
            st = s.get("status", "unknown")
            status_counts[st] = status_counts.get(st, 0) + 1
            if st == "active":
                active_subs += 1

            plan = s.get("plan") or {}
            freq = plan.get("interval", "monthly")
            freq_counts[freq] = freq_counts.get(freq, 0) + 1

        # 2. Invoices summary
        invoices = await db.select(
            table="invoices",
            columns="id, status, total, amount_paid, due_date, issue_date",
        )
        invs_list = invoices if isinstance(invoices, list) else []

        paid_count = 0
        partially_paid_count = 0
        open_count = 0
        overdue_count = 0
        outstanding_amount = Decimal("0.00")

        for inv in invs_list:
            st = inv.get("status")
            tot = Decimal(str(inv.get("total", 0)))
            paid = Decimal(str(inv.get("amount_paid", 0)))
            bal = max(Decimal("0.00"), tot - paid)

            if st == "paid":
                paid_count += 1
            elif st == "partially_paid" or (paid > 0 and paid < tot):
                partially_paid_count += 1
                outstanding_amount += bal
            elif st == "open" or st == "draft":
                open_count += 1
                outstanding_amount += bal

            due_d = inv.get("due_date")
            if due_d and due_d < today_str and st in ("open", "partially_paid", "overdue") and bal > 0:
                overdue_count += 1

        # 3. Payments / Revenue for period
        p_filters: Dict[str, Any] = {}
        if start_date:
            p_filters["paid_at"] = f"gte.{start_date}T00:00:00"
        if end_date:
            p_filters["paid_at"] = f"lte.{end_date}T23:59:59"

        payments = await db.select(
            table="payments",
            columns="amount, paid_at",
            params=p_filters,
        )
        payments_list = payments if isinstance(payments, list) else []

        revenue_for_period = Decimal("0.00")
        for p in payments_list:
            revenue_for_period += Decimal(str(p.get("amount", 0)))

        # 4. Recent invoices
        recent_invs = await db.select(
            table="invoices",
            columns="id, number, status, total, amount_paid, issue_date, customer:customers(name)",
            order="issue_date.desc",
            limit=5,
        )

        # 5. Recent payments
        recent_pmts = await db.select(
            table="payments",
            columns="id, amount, method, paid_at, customer:customers(name), invoice:invoices(number)",
            order="paid_at.desc",
            limit=5,
        )

        return {
            "active_subscriptions": active_subs,
            "subscriptions_by_status": status_counts,
            "subscriptions_by_frequency": freq_counts,
            "revenue_for_period": float(revenue_for_period),
            "outstanding_invoices_amount": float(outstanding_amount),
            "overdue_invoices_count": overdue_count,
            "paid_invoices_count": paid_count,
            "partially_paid_invoices_count": partially_paid_count,
            "open_invoices_count": open_count,
            "recent_invoices": recent_invs if isinstance(recent_invs, list) else [],
            "recent_payments": recent_pmts if isinstance(recent_pmts, list) else [],
        }

    @staticmethod
    async def get_revenue_report(
        db: SupabaseDataClient,
        start_date: str,
        end_date: str,
    ) -> Dict[str, Any]:
        """
        Breakdown of revenue and invoices within date range.
        """
        payments = await db.select(
            table="payments",
            columns="amount, paid_at",
            params={
                "paid_at": f"gte.{start_date}T00:00:00",
                "paid_at": f"lte.{end_date}T23:59:59",
            },
            order="paid_at.asc",
        )
        pmts_list = payments if isinstance(payments, list) else []

        invoices = await db.select(
            table="invoices",
            columns="total, issue_date",
            params={
                "issue_date": f"gte.{start_date}",
                "issue_date": f"lte.{end_date}",
            },
            order="issue_date.asc",
        )
        invs_list = invoices if isinstance(invoices, list) else []

        # Aggregate by date
        daily_map: Dict[str, Dict[str, Any]] = {}

        total_rev = Decimal("0.00")
        total_inv = Decimal("0.00")

        for p in pmts_list:
            dt = str(p.get("paid_at", ""))[:10]
            amt = Decimal(str(p.get("amount", 0)))
            total_rev += amt
            if dt not in daily_map:
                daily_map[dt] = {"date": dt, "revenue": Decimal("0.00"), "invoices_count": 0, "payments_count": 0}
            daily_map[dt]["revenue"] += amt
            daily_map[dt]["payments_count"] += 1

        for i in invs_list:
            dt = str(i.get("issue_date", ""))[:10]
            amt = Decimal(str(i.get("total", 0)))
            total_inv += amt
            if dt not in daily_map:
                daily_map[dt] = {"date": dt, "revenue": Decimal("0.00"), "invoices_count": 0, "payments_count": 0}
            daily_map[dt]["invoices_count"] += 1

        data_list = []
        for d in sorted(daily_map.keys()):
            row = daily_map[d]
            data_list.append({
                "date": row["date"],
                "revenue": float(row["revenue"]),
                "invoices_count": row["invoices_count"],
                "payments_count": row["payments_count"],
            })

        return {
            "start_date": start_date,
            "end_date": end_date,
            "total_revenue": float(total_rev),
            "total_invoiced": float(total_inv),
            "data": data_list,
        }
