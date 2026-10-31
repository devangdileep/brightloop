import pytest
from starlette.testclient import TestClient
from app.core.permissions import Role
from app.core.security import AuthenticatedUser
from app.database.supabase_client import SupabaseDataClient
from app.dependencies.authentication import get_current_user, get_db_client
from app.main import app


class MockSupabaseClient(SupabaseDataClient):
    """In-memory mock Supabase Data Client for unit tests."""

    def __init__(self, token: str = "mock-token", is_service_role: bool = False):
        self.base_url = "https://mock.supabase.co/rest/v1"
        self.auth_url = "https://mock.supabase.co/auth/v1"
        self.token = token
        self.is_service_role = is_service_role
        self.store = {
            "products": [],
            "product_variants": [],
            "plans": [],
            "customers": [],
            "taxes": [],
            "discounts": [],
            "quotations": [],
            "quotation_items": [],
            "subscriptions": [],
            "subscription_lines": [],
            "invoices": [],
            "invoice_items": [],
            "payments": [],
            "app_settings": [{
                "id": 1,
                "company_name": "Brightloop Software",
                "support_email": "billing@brightloop.io",
                "currency": "USD",
                "invoice_prefix": "INV",
                "invoice_due_days": 14,
            }],
        }
        self.counters = {"invoice": 100, "quotation": 50}

    async def select(self, table: str, columns: str = "*", params: dict = None, **kwargs):
        rows = list(self.store.get(table, []))
        if params:
            for k, v in params.items():
                if v.startswith("eq."):
                    target = v[3:]
                    rows = [r for r in rows if str(r.get(k)) == target]
                elif v.startswith("neq."):
                    target = v[4:]
                    rows = [r for r in rows if str(r.get(k)) != target]
                elif v.startswith("in."):
                    allowed = v[3:].strip("()").split(",")
                    rows = [r for r in rows if str(r.get(k)) in allowed]
                elif v.startswith("lte."):
                    target = v[4:]
                    rows = [r for r in rows if str(r.get(k, "")) <= target]

        if kwargs.get("single"):
            return dict(rows[0]) if rows else {}
        if kwargs.get("count") == "exact":
            return [dict(r) for r in rows], len(rows)
        return [dict(r) for r in rows]

    async def insert(self, table: str, data: dict, **kwargs):
        if table not in self.store:
            self.store[table] = []
        import uuid
        row = dict(data)
        if "id" not in row:
            row["id"] = str(uuid.uuid4())
        self.store[table].append(row)
        return dict(row)

    async def update(self, table: str, data: dict, params: dict, **kwargs):
        rows = await self.select(table, params=params)
        if not rows:
            return {}
        target = rows[0] if isinstance(rows, list) else rows
        # Find in store
        for stored in self.store.get(table, []):
            if stored.get("id") == target.get("id"):
                stored.update(data)
                return dict(stored)
        target.update(data)
        return dict(target)

    async def delete(self, table: str, params: dict):
        return True

    async def rpc(self, fn_name: str, params: dict = None):
        if fn_name == "next_document_number":
            kind = params.get("p_kind", "doc")
            val = self.counters.get(kind, 1) + 1
            self.counters[kind] = val
            prefix = "INV" if kind == "invoice" else "QUO"
            return f"{prefix}-2026-{val:04d}"
        return "OK"


@pytest.fixture
def mock_db():
    return MockSupabaseClient()


@pytest.fixture
def admin_user():
    return AuthenticatedUser(
        id="00000000-0000-0000-0000-000000000001",
        email="admin@brightloop.io",
        full_name="Admin User",
        role=Role.ADMIN,
        token="mock-admin-token",
    )


@pytest.fixture
def staff_user():
    return AuthenticatedUser(
        id="00000000-0000-0000-0000-000000000002",
        email="staff@brightloop.io",
        full_name="Staff User",
        role=Role.STAFF,
        token="mock-staff-token",
    )


@pytest.fixture
def customer_user():
    return AuthenticatedUser(
        id="00000000-0000-0000-0000-000000000003",
        email="customer@example.com",
        full_name="Customer User",
        role=Role.CUSTOMER,
        token="mock-customer-token",
    )


@pytest.fixture
def client():
    with TestClient(app) as tc:
        yield tc
