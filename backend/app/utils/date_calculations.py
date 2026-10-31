from datetime import date, datetime
from typing import Union
from dateutil.relativedelta import relativedelta


def parse_date(d: Union[str, date, datetime]) -> date:
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, date):
        return d
    return datetime.strptime(str(d)[:10], "%Y-%m-%d").date()


def add_billing_interval(start_date: Union[str, date], interval: str, count: int = 1) -> date:
    d = parse_date(start_date)
    interval_lower = interval.lower()

    if interval_lower == "daily":
        return d + relativedelta(days=count)
    elif interval_lower == "weekly":
        return d + relativedelta(weeks=count)
    elif interval_lower == "monthly":
        return d + relativedelta(months=count)
    elif interval_lower == "quarterly":
        return d + relativedelta(months=3 * count)
    elif interval_lower == "yearly":
        return d + relativedelta(years=count)
    else:
        # Default fallback to monthly
        return d + relativedelta(months=count)


def format_date_iso(d: Union[date, datetime]) -> str:
    if isinstance(d, datetime):
        return d.strftime("%Y-%m-%d")
    return d.isoformat()
