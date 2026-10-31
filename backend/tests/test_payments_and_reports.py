from decimal import Decimal
import pytest
from app.core.exceptions import BadRequestException, ConflictException
from app.schemas.payments import PaymentCreate
from app.services.payment_service import PaymentService
from app.services.report_service import ReportService


@pytest.mark.asyncio
async def test_payment_recording_and_validation(mock_db):
    await mock_db.insert("customers", {"id": "c-300", "name": "Cyberdyne Systems", "email": "info@cyberdyne.com"})
    await mock_db.insert(
        "invoices",
        {
            "id": "inv-300",
            "customer_id": "c-300",
            "number": "INV-2026-0300",
            "status": "open",
            "total": 500.0,
            "amount_paid": 0.0,
        },
    )

    # 1. Successful partial payment
    p_req1 = PaymentCreate(
        invoice_id="inv-300",
        amount=Decimal("200.00"),
        method="card",
        reference="TXN-001",
    )
    res1 = await PaymentService.record_payment(mock_db, p_req1, user_id="staff-1")
    assert res1["payment"]["amount"] == 200.00
    assert res1["payment"]["reference"] == "TXN-001"

    # Simulate trigger update on mock invoice
    await mock_db.update("invoices", {"amount_paid": 200.0}, {"id": "eq.inv-300"})

    # 2. Reject duplicate transaction reference
    with pytest.raises(ConflictException):
        await PaymentService.record_payment(mock_db, p_req1, user_id="staff-1")

    # 3. Reject payment exceeding remaining balance (remaining = 300.00, trying 350.00)
    p_req_excess = PaymentCreate(
        invoice_id="inv-300",
        amount=Decimal("350.00"),
        method="bank_transfer",
        reference="TXN-002",
    )
    with pytest.raises(BadRequestException):
        await PaymentService.record_payment(mock_db, p_req_excess, user_id="staff-1")


@pytest.mark.asyncio
async def test_dashboard_metrics(mock_db):
    # Insert test subscriptions
    await mock_db.insert("subscriptions", {"id": "s-1", "status": "active", "plan": {"interval": "monthly"}})
    await mock_db.insert("subscriptions", {"id": "s-2", "status": "active", "plan": {"interval": "yearly"}})
    await mock_db.insert("subscriptions", {"id": "s-3", "status": "canceled", "plan": {"interval": "monthly"}})

    # Insert test invoices
    await mock_db.insert("invoices", {"id": "i-1", "status": "paid", "total": 200.0, "amount_paid": 200.0})
    await mock_db.insert("invoices", {"id": "i-2", "status": "open", "total": 300.0, "amount_paid": 0.0, "due_date": "2026-12-31"})

    # Insert payments
    await mock_db.insert("payments", {"id": "pm-1", "amount": 200.0, "paid_at": "2026-06-01T10:00:00Z"})

    metrics = await ReportService.get_dashboard_metrics(mock_db)
    assert metrics["active_subscriptions"] == 2
    assert metrics["subscriptions_by_status"]["active"] == 2
    assert metrics["subscriptions_by_status"]["canceled"] == 1
    assert metrics["paid_invoices_count"] == 1
    assert metrics["open_invoices_count"] == 1
    assert metrics["revenue_for_period"] == 200.00
