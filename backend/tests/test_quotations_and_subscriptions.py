from decimal import Decimal
import pytest
from app.schemas.quotations import QuotationCreate, QuotationItemCreate
from app.schemas.subscriptions import SubscriptionCreate
from app.services.quotation_service import QuotationService
from app.services.subscription_service import SubscriptionService


@pytest.mark.asyncio
async def test_quotation_calculations_and_creation(mock_db):
    # Setup customer, tax, discount
    await mock_db.insert("customers", {"id": "cust-1", "name": "Acme Inc", "email": "acme@example.com"})
    await mock_db.insert("taxes", {"id": "tax-1", "name": "VAT", "rate": 10.0, "is_active": True})
    await mock_db.insert("discounts", {"id": "disc-1", "code": "DEAL10", "type": "percentage", "value": 10.0, "is_active": True})

    payload = QuotationCreate(
        customer_id="cust-1",
        valid_until="2026-12-31",
        discount_id="disc-1",
        tax_id="tax-1",
        items=[
            QuotationItemCreate(description="Workflow seat", quantity=Decimal("5"), unit_price=Decimal("100.00")),
            QuotationItemCreate(description="Onboarding", quantity=Decimal("1"), unit_price=Decimal("500.00")),
        ],
    )

    quotation = await QuotationService.create_quotation(mock_db, payload, user_id="user-1")

    # Subtotal: 5*100 + 1*500 = 1000.00
    # Discount: 10% of 1000 = 100.00
    # Tax: 10% of (1000 - 100) = 90.00
    # Total: 1000 - 100 + 90 = 990.00
    assert quotation["subtotal"] == 1000.00
    assert quotation["discount_total"] == 100.00
    assert quotation["tax_total"] == 90.00
    assert quotation["total"] == 990.00
    assert quotation["number"].startswith("QUO-")


@pytest.mark.asyncio
async def test_subscription_lifecycle_and_transitions(mock_db):
    await mock_db.insert("customers", {"id": "cust-2", "name": "Globex", "email": "globex@example.com"})
    await mock_db.insert(
        "plans",
        {
            "id": "plan-1",
            "name": "Standard Monthly",
            "price": 50.0,
            "interval": "monthly",
            "interval_count": 1,
            "trial_days": 0,
        },
    )

    # 1. Create subscription
    sub_payload = SubscriptionCreate(
        customer_id="cust-2",
        plan_id="plan-1",
        quantity=2,
        started_at="2026-05-01",
        status="active",
    )
    sub = await SubscriptionService.create_subscription(mock_db, sub_payload, user_id="staff-1")
    assert sub["status"] == "active"
    assert sub["current_period_start"] == "2026-05-01"
    assert sub["current_period_end"] == "2026-06-01"
    sub_id = sub["id"]

    # 2. Pause subscription
    paused = await SubscriptionService.pause_subscription(mock_db, sub_id, reason="Customer migrating systems")
    assert paused["status"] == "paused"

    # 3. Resume subscription
    resumed = await SubscriptionService.resume_subscription(mock_db, sub_id)
    assert resumed["status"] == "active"

    # 4. Cancel at period end
    canceled_period = await SubscriptionService.cancel_subscription(mock_db, sub_id, immediate=False)
    assert canceled_period["cancel_at_period_end"] is True

    # 5. Immediate cancellation
    closed = await SubscriptionService.cancel_subscription(mock_db, sub_id, immediate=True)
    assert closed["status"] == "canceled"
