from typing import Any, Dict, List, Optional, Tuple
from app.core.exceptions import NotFoundException
from app.database.supabase_client import SupabaseDataClient
from app.schemas.plans import PlanCreate, PlanUpdate
from app.utils.pagination import PaginationParams


class PlanService:
    @staticmethod
    async def list_plans(
        db: SupabaseDataClient,
        params: PaginationParams,
        is_active: Optional[bool] = None,
        product_id: Optional[str] = None,
        interval: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        filters: Dict[str, Any] = {}
        if is_active is not None:
            filters["is_active"] = f"eq.{str(is_active).lower()}"
        if product_id:
            filters["product_id"] = f"eq.{product_id}"
        if interval:
            filters["interval"] = f"eq.{interval}"

        plans_data, total = await db.select(
            table="plans",
            columns="*",
            params=filters,
            order="price.asc",
            limit=params.limit,
            offset=params.offset,
            count="exact",
        )
        return plans_data, total

    @staticmethod
    async def get_plan(db: SupabaseDataClient, plan_id: str) -> Dict[str, Any]:
        data = await db.select(
            table="plans",
            columns="*",
            params={"id": f"eq.{plan_id}"},
            single=True,
        )
        if not data:
            raise NotFoundException("Plan not found")
        return data

    @staticmethod
    async def create_plan(db: SupabaseDataClient, payload: PlanCreate) -> Dict[str, Any]:
        plan_dict = payload.model_dump()
        if "price" in plan_dict:
            plan_dict["price"] = float(plan_dict["price"])
        # Remove fields that might not be in legacy schema if not migrated yet
        filtered_dict = {k: v for k, v in plan_dict.items() if v is not None}
        return await db.insert(table="plans", data=filtered_dict, single=True)

    @staticmethod
    async def update_plan(
        db: SupabaseDataClient, plan_id: str, payload: PlanUpdate
    ) -> Dict[str, Any]:
        update_data = payload.model_dump(exclude_unset=True)
        if "price" in update_data and update_data["price"] is not None:
            update_data["price"] = float(update_data["price"])

        if not update_data:
            return await PlanService.get_plan(db, plan_id)

        return await db.update(
            table="plans",
            data=update_data,
            params={"id": f"eq.{plan_id}"},
            single=True,
        )

    @staticmethod
    async def deactivate_plan(db: SupabaseDataClient, plan_id: str) -> Dict[str, Any]:
        return await db.update(
            table="plans",
            data={"is_active": False},
            params={"id": f"eq.{plan_id}"},
            single=True,
        )
