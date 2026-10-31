from datetime import date
from decimal import Decimal
import pytest
from app.services.billing_service import BillingService
from app.services.invoice_service import InvoiceService


@pytest.mark.asyncio
async def test_invoice_generation_and_duplicate_prevention(mock_db):
    # Setup customer, plan, subscription
    await mock_db.insert("customers", {"id": "c-100", "name": "Stark Industries", "email": "tony@stark.com"})
    await mock_db.insert(
        "plans",
        {
            "id": "p-100",
            "name": "Enterprise Automation",
            "price": 200.0,
            "interval": "monthly",
            "interval_count": 1,
        },
    )
    await mock_db.insert(
        "subscriptions",
        {
            "id": "s-100",
            "customer_id": "c-100",
            "plan_id": "p-100",
            "quantity": 3,
            "status": "active",
            "current_period_start": "2026-06-01",
            "current_period_end": "2026-07-01",
        },
    )

    # 1. First invoice generation
    res1 = await InvoiceService.generate_invoice_for_subscription(mock_db, "s-100")
    assert res1["already_existed"] is False
    inv1 = res1["invoice"]
    assert inv1["subtotal"] == 600.00  # 3 * 200
    assert inv1["total"] == 600.00
    assert inv1["number"].startswith("INV-")

    # 2. Second invoice generation for same period -> must return already_existed = True without creating new row
    res2 = await InvoiceService.generate_invoice_for_subscription(mock_db, "s-100")
    assert res2["already_existed"] is True
    assert res2["invoice"]["id"] == inv1["id"]

    # Verify only one invoice exists in database
    all_invs = await mock_db.select("invoices", params={"subscription_id": "eq.s-100"})
    assert len(all_invs) == 1


@pytest.mark.asyncio
async def test_recurring_billing_cycle(mock_db):
    await mock_db.insert("customers", {"id": "c-200", "name": "Wayne Enterprises", "email": "bruce@wayne.com"})
    await mock_db.insert(
        "plans",
        {
            "id": "p-200",
            "name": "Cloud Workspace",
            "price": 100.0,
            "interval": "monthly",
            "interval_count": 1,
        },
    )
    # Subscription due on 2026-07-01
    await mock_db.insert(
        "subscriptions",
        {
            "id": "s-200",
            "customer_id": "c-200",
            "plan_id": "p-200",
            "quantity": 1,
            "status": "active",
            "current_period_start": "2026-06-01",
            "current_period_end": "2026-07-01",
        },
    )

    # Execute billing cycle on 2026-07-01
    run_res = await BillingService.run_billing_cycle(
        db=mock_db, target_date=date(2026, 7, 1)
    )
    assert run_res["ok"] is True
    assert run_res["created"] == 1
    assert run_res["skipped"] == 0

    # Verify subscription period advanced to next month (2026-07-01 to 2026-08-01)
    sub = await mock_db.select("subscriptions", params={"id": "eq.s-200"}, single=True)
    assert sub["current_period_start"] == "2026-07-01"
    assert sub["current_period_end"] == "2026-08-01"

    # Running the billing cycle again on same day skips already processed subscription
    run_res2 = await BillingService.run_billing_cycle(
        db=mock_db, target_date=date(2026, 7, 1)
    )
    # The subscription current_period_end is now 2026-08-01 > 2026-07-01, so not due
    assert run_res2["created"] == 0
