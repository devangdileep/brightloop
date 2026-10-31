from datetime import date
from app.utils.date_calculations import add_billing_interval, parse_date


def test_daily_interval():
    start = date(2026, 1, 15)
    res = add_billing_interval(start, "daily", 1)
    assert res == date(2026, 1, 16)

    res_3 = add_billing_interval(start, "daily", 5)
    assert res_3 == date(2026, 1, 20)


def test_weekly_interval():
    start = date(2026, 3, 1)
    res = add_billing_interval(start, "weekly", 1)
    assert res == date(2026, 3, 8)

    res_2 = add_billing_interval(start, "weekly", 2)
    assert res_2 == date(2026, 3, 15)


def test_monthly_interval_calendar_aware():
    start = date(2026, 1, 31)
    # January 31 + 1 month in non-leap year -> February 28
    res = add_billing_interval(start, "monthly", 1)
    assert res == date(2026, 2, 28)

    # March 31 + 1 month -> April 30
    res_apr = add_billing_interval(date(2026, 3, 31), "monthly", 1)
    assert res_apr == date(2026, 4, 30)


def test_quarterly_interval():
    start = date(2026, 1, 1)
    res = add_billing_interval(start, "quarterly", 1)
    assert res == date(2026, 4, 1)


def test_yearly_interval():
    start = date(2024, 2, 29)  # Leap year
    res = add_billing_interval(start, "yearly", 1)
    # Next year is 2025 (non leap) -> Feb 28
    assert res == date(2025, 2, 28)

    start_std = date(2026, 6, 1)
    res_std = add_billing_interval(start_std, "yearly", 1)
    assert res_std == date(2027, 6, 1)
