from typing import Any, Dict, List, Optional, Tuple
from app.core.exceptions import ConflictException, NotFoundException
from app.database.supabase_client import SupabaseDataClient
from app.schemas.customers import CustomerCreate, CustomerUpdate
from app.utils.pagination import PaginationParams


class CustomerService:
    @staticmethod
    async def list_customers(
        db: SupabaseDataClient,
        params: PaginationParams,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        filters: Dict[str, Any] = {}
        if status:
            filters["status"] = f"eq.{status}"
        if search:
            filters["or"] = f"(name.ilike.*{search}*,email.ilike.*{search}*,company.ilike.*{search}*)"

        data, total = await db.select(
            table="customers",
            columns="*",
            params=filters,
            order="created_at.desc",
            limit=params.limit,
            offset=params.offset,
            count="exact",
        )
        return data, total

    @staticmethod
    async def get_customer(db: SupabaseDataClient, customer_id: str) -> Dict[str, Any]:
        data = await db.select(
            table="customers",
            columns="*",
            params={"id": f"eq.{customer_id}"},
            single=True,
        )
        if not data:
            raise NotFoundException("Customer not found")
        return data

    @staticmethod
    async def get_customer_by_user_id(db: SupabaseDataClient, user_id: str) -> Optional[Dict[str, Any]]:
        try:
            data = await db.select(
                table="customers",
                columns="*",
                params={"user_id": f"eq.{user_id}"},
                single=True,
            )
            return data
        except Exception:
            return None

    @staticmethod
    async def create_customer(db: SupabaseDataClient, payload: CustomerCreate) -> Dict[str, Any]:
        # Check for duplicate email
        existing = await db.select(
            table="customers",
            columns="id, email, user_id",
            params={"email": f"eq.{payload.email}"},
        )
        if existing and len(existing) > 0:
            raise ConflictException(f"Customer with email '{payload.email}' already exists")

        # Check for duplicate user_id if supplied
        if payload.user_id:
            existing_user = await db.select(
                table="customers",
                columns="id, user_id",
                params={"user_id": f"eq.{payload.user_id}"},
            )
            if existing_user and len(existing_user) > 0:
                raise ConflictException("A customer record is already linked to this user profile")

        c_dict = payload.model_dump()
        return await db.insert(table="customers", data=c_dict, single=True)

    @staticmethod
    async def update_customer(
        db: SupabaseDataClient, customer_id: str, payload: CustomerUpdate
    ) -> Dict[str, Any]:
        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            return await CustomerService.get_customer(db, customer_id)

        return await db.update(
            table="customers",
            data=update_data,
            params={"id": f"eq.{customer_id}"},
            single=True,
        )

    @staticmethod
    async def get_customer_subscriptions(
        db: SupabaseDataClient, customer_id: str
    ) -> List[Dict[str, Any]]:
        data = await db.select(
            table="subscriptions",
            columns="*, plan:plans(*)",
            params={"customer_id": f"eq.{customer_id}"},
            order="created_at.desc",
        )
        return data if isinstance(data, list) else []

    @staticmethod
    async def get_customer_invoices(
        db: SupabaseDataClient, customer_id: str
    ) -> List[Dict[str, Any]]:
        data = await db.select(
            table="invoices",
            columns="*, items:invoice_items(*)",
            params={"customer_id": f"eq.{customer_id}"},
            order="issue_date.desc",
        )
        return data if isinstance(data, list) else []
