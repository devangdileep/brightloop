from datetime import date
from decimal import Decimal
import pytest
from starlette.testclient import TestClient
from app.core.security import AuthenticatedUser
from app.dependencies.authentication import get_current_user, get_db_client
from app.main import app
from app.schemas.discounts import DiscountValidationRequest
from app.services.discount_service import DiscountService


@pytest.mark.asyncio
async def test_discount_validation_percentage_and_limits(mock_db):
    # Setup test discount
    await mock_db.insert(
        "discounts",
        {
            "id": "disc-1",
            "code": "SAVE20",
            "type": "percentage",
            "value": 20.0,
            "is_active": True,
            "valid_from": "2026-01-01",
            "valid_until": "2026-12-31",
            "max_redemptions": 5,
            "times_redeemed": 2,
        },
    )

    # Validate valid coupon
    val_req = DiscountValidationRequest(code="SAVE20", subtotal=Decimal("100.00"), quantity=1)
    res = await DiscountService.validate_discount(mock_db, val_req, today=date(2026, 6, 1))
    assert res.valid is True
    assert res.discount_amount == Decimal("20.00")

    # Validate expired coupon
    res_expired = await DiscountService.validate_discount(mock_db, val_req, today=date(2027, 1, 1))
    assert res_expired.valid is False
    assert "expired" in res_expired.reason.lower()

    # Exhaust usage limit
    await mock_db.update("discounts", {"times_redeemed": 5}, {"id": "eq.disc-1"})
    res_exhausted = await DiscountService.validate_discount(mock_db, val_req, today=date(2026, 6, 1))
    assert res_exhausted.valid is False
    assert "limit" in res_exhausted.reason.lower()


@pytest.mark.asyncio
async def test_discount_fixed_amount(mock_db):
    await mock_db.insert(
        "discounts",
        {
            "id": "disc-2",
            "code": "FLAT15",
            "type": "fixed",
            "value": 15.0,
            "is_active": True,
            "valid_from": None,
            "valid_until": None,
            "max_redemptions": None,
            "times_redeemed": 0,
        },
    )

    val_req = DiscountValidationRequest(code="FLAT15", subtotal=Decimal("50.00"), quantity=1)
    res = await DiscountService.validate_discount(mock_db, val_req, today=date(2026, 6, 1))
    assert res.valid is True
    assert res.discount_amount == Decimal("15.00")

    # If subtotal is smaller than fixed discount, discount is capped at subtotal
    val_req_small = DiscountValidationRequest(code="FLAT15", subtotal=Decimal("10.00"), quantity=1)
    res_small = await DiscountService.validate_discount(mock_db, val_req_small, today=date(2026, 6, 1))
    assert res_small.valid is True
    assert res_small.discount_amount == Decimal("10.00")


def test_tax_creation_and_default(client: TestClient, admin_user: AuthenticatedUser, mock_db):
    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[get_db_client] = lambda: mock_db
    try:
        res = client.post(
            "/api/v1/taxes",
            json={"name": "GST", "rate": 18.0, "country": "India", "is_default": True},
        )
        assert res.status_code == 201
        tax = res.json()
        assert tax["name"] == "GST"
        assert float(tax["rate"]) == 18.0
        assert tax["is_default"] is True
    finally:
        app.dependency_overrides.clear()
