from starlette.testclient import TestClient
from app.core.security import AuthenticatedUser
from app.dependencies.authentication import get_current_user, get_db_client
from app.main import app


def test_health_endpoint(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data

    response_v1 = client.get("/api/v1/health")
    assert response_v1.status_code == 200


def test_protected_endpoint_without_token(client: TestClient):
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    assert "detail" in response.json()


def test_get_me_as_admin(client: TestClient, admin_user: AuthenticatedUser, mock_db):
    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[get_db_client] = lambda: mock_db
    try:
        response = client.get("/api/v1/me")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == admin_user.id
        assert data["email"] == admin_user.email
        assert data["role"] == "admin"
    finally:
        app.dependency_overrides.clear()


def test_admin_only_endpoint_forbidden_for_customer(
    client: TestClient, customer_user: AuthenticatedUser, mock_db
):
    app.dependency_overrides[get_current_user] = lambda: customer_user
    app.dependency_overrides[get_db_client] = lambda: mock_db
    try:
        # Customer trying to create product -> 403 Forbidden
        response = client.post("/api/v1/products", json={"name": "Test Product", "base_price": 50.0})
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_staff_endpoint_forbidden_for_customer(
    client: TestClient, customer_user: AuthenticatedUser, mock_db
):
    app.dependency_overrides[get_current_user] = lambda: customer_user
    app.dependency_overrides[get_db_client] = lambda: mock_db
    try:
        # Customer trying to create a customer -> 403 Forbidden
        response = client.post(
            "/api/v1/customers",
            json={"name": "Acme Inc", "email": "acme@example.com"}
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
