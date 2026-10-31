from typing import Any, Dict, List, Optional, Tuple
from app.core.exceptions import NotFoundException
from app.database.supabase_client import SupabaseDataClient
from app.schemas.taxes import TaxCreate, TaxUpdate
from app.utils.pagination import PaginationParams


class TaxService:
    @staticmethod
    async def list_taxes(
        db: SupabaseDataClient,
        params: PaginationParams,
        is_active: Optional[bool] = None,
        country: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        filters: Dict[str, Any] = {}
        if is_active is not None:
            filters["is_active"] = f"eq.{str(is_active).lower()}"
        if country:
            filters["country"] = f"eq.{country}"

        taxes_data, total = await db.select(
            table="taxes",
            columns="*",
            params=filters,
            order="rate.asc",
            limit=params.limit,
            offset=params.offset,
            count="exact",
        )
        return taxes_data, total

    @staticmethod
    async def get_tax(db: SupabaseDataClient, tax_id: str) -> Dict[str, Any]:
        data = await db.select(
            table="taxes",
            columns="*",
            params={"id": f"eq.{tax_id}"},
            single=True,
        )
        if not data:
            raise NotFoundException("Tax configuration not found")
        return data

    @staticmethod
    async def get_default_tax(db: SupabaseDataClient) -> Optional[Dict[str, Any]]:
        # Check app_settings default_tax_id first
        try:
            settings_row = await db.select(
                table="app_settings",
                columns="default_tax_id",
                params={"id": "eq.1"},
                single=True,
            )
            default_id = settings_row.get("default_tax_id")
            if default_id:
                return await TaxService.get_tax(db, default_id)
        except Exception:
            pass

        # Fallback to is_default = true in taxes table
        try:
            data = await db.select(
                table="taxes",
                columns="*",
                params={"is_default": "eq.true", "is_active": "eq.true"},
                single=True,
            )
            return data
        except Exception:
            return None

    @staticmethod
    async def create_tax(db: SupabaseDataClient, payload: TaxCreate) -> Dict[str, Any]:
        t_dict = payload.model_dump()
        t_dict["rate"] = float(t_dict["rate"])

        if payload.is_default:
            try:
                # Unmark previous defaults
                await db.update(
                    table="taxes",
                    data={"is_default": False},
                    params={"is_default": "eq.true"},
                    single=False,
                )
            except Exception:
                pass

        created = await db.insert(table="taxes", data=t_dict, single=True)
        return created

    @staticmethod
    async def update_tax(
        db: SupabaseDataClient, tax_id: str, payload: TaxUpdate
    ) -> Dict[str, Any]:
        update_data = payload.model_dump(exclude_unset=True)
        if "rate" in update_data and update_data["rate"] is not None:
            update_data["rate"] = float(update_data["rate"])

        if update_data.get("is_default"):
            try:
                await db.update(
                    table="taxes",
                    data={"is_default": False},
                    params={"id": f"neq.{tax_id}", "is_default": "eq.true"},
                    single=False,
                )
            except Exception:
                pass

        if not update_data:
            return await TaxService.get_tax(db, tax_id)

        return await db.update(
            table="taxes",
            data=update_data,
            params={"id": f"eq.{tax_id}"},
            single=True,
        )

    @staticmethod
    async def deactivate_tax(db: SupabaseDataClient, tax_id: str) -> Dict[str, Any]:
        return await db.update(
            table="taxes",
            data={"is_active": False},
            params={"id": f"eq.{tax_id}"},
            single=True,
        )
