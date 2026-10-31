from starlette.testclient import TestClient
from app.core.security import AuthenticatedUser
from app.dependencies.authentication import get_current_user, get_db_client
from app.main import app


def test_product_crud_as_admin(client: TestClient, admin_user: AuthenticatedUser, mock_db):
    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[get_db_client] = lambda: mock_db
    try:
        # Create product
        res = client.post(
            "/api/v1/products",
            json={
                "name": "Brightloop Pro",
                "description": "Professional subscription",
                "category": "Platform",
                "base_price": 99.00,
            },
        )
        assert res.status_code == 201
        prod = res.json()
        assert prod["name"] == "Brightloop Pro"
        assert float(prod["base_price"]) == 99.00
        prod_id = prod["id"]

        # List products
        list_res = client.get("/api/v1/products")
        assert list_res.status_code == 200
        items = list_res.json()["items"]
        assert len(items) >= 1

        # Update product
        up_res = client.put(
            f"/api/v1/products/{prod_id}",
            json={"name": "Brightloop Pro Enterprise"},
        )
        assert up_res.status_code == 200
        assert up_res.json()["name"] == "Brightloop Pro Enterprise"
    finally:
        app.dependency_overrides.clear()


def test_plan_crud_as_admin(client: TestClient, admin_user: AuthenticatedUser, mock_db):
    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[get_db_client] = lambda: mock_db
    try:
        # Create plan
        res = client.post(
            "/api/v1/plans",
            json={
                "name": "Growth Monthly",
                "price": 49.00,
                "interval": "monthly",
                "interval_count": 1,
                "trial_days": 14,
                "features": ["SSO", "Audit Logs"],
            },
        )
        assert res.status_code == 201
        plan = res.json()
        assert plan["name"] == "Growth Monthly"
        assert plan["interval"] == "monthly"
        assert plan["trial_days"] == 14
        plan_id = plan["id"]

        # Deactivate plan
        deact_res = client.delete(f"/api/v1/plans/{plan_id}")
        assert deact_res.status_code == 200
        assert deact_res.json()["ok"] is True
    finally:
        app.dependency_overrides.clear()
