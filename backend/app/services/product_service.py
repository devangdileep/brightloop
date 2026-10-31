from typing import Any, Dict, List, Optional, Tuple
from app.core.exceptions import NotFoundException
from app.database.supabase_client import SupabaseDataClient
from app.schemas.products import ProductCreate, ProductUpdate, ProductVariantCreate, ProductVariantUpdate
from app.utils.pagination import PaginationParams


class ProductService:
    @staticmethod
    async def list_products(
        db: SupabaseDataClient,
        params: PaginationParams,
        is_active: Optional[bool] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        filters: Dict[str, Any] = {}
        if is_active is not None:
            filters["is_active"] = f"eq.{str(is_active).lower()}"
        if category:
            filters["category"] = f"eq.{category}"
        if search:
            filters["name"] = f"ilike.*{search}*"

        products_data, total = await db.select(
            table="products",
            columns="*",
            params=filters,
            order="created_at.desc",
            limit=params.limit,
            offset=params.offset,
            count="exact",
        )
        return products_data, total

    @staticmethod
    async def get_product(db: SupabaseDataClient, product_id: str) -> Dict[str, Any]:
        data = await db.select(
            table="products",
            columns="*",
            params={"id": f"eq.{product_id}"},
            single=True,
        )
        if not data:
            raise NotFoundException("Product not found")

        # Try to fetch variants if product_variants table exists
        try:
            variants = await db.select(
                table="product_variants",
                columns="*",
                params={"product_id": f"eq.{product_id}"},
                order="created_at.asc",
            )
            data["variants"] = variants if isinstance(variants, list) else []
        except Exception:
            data["variants"] = []

        return data

    @staticmethod
    async def create_product(db: SupabaseDataClient, payload: ProductCreate) -> Dict[str, Any]:
        product_dict = payload.model_dump(exclude={"variants"})
        # Decimal to float/str for PostgREST
        if "base_price" in product_dict:
            product_dict["base_price"] = float(product_dict["base_price"])

        created = await db.insert(table="products", data=product_dict, single=True)
        product_id = created.get("id")

        created_variants = []
        if payload.variants and product_id:
            for variant in payload.variants:
                v_dict = variant.model_dump()
                v_dict["product_id"] = product_id
                v_dict["price_modifier"] = float(v_dict.get("price_modifier", 0.0))
                if "cost_price" in v_dict and v_dict["cost_price"] is not None:
                    v_dict["cost_price"] = float(v_dict["cost_price"])
                try:
                    res = await db.insert(table="product_variants", data=v_dict, single=True)
                    created_variants.append(res)
                except Exception:
                    pass

        created["variants"] = created_variants
        return created

    @staticmethod
    async def update_product(
        db: SupabaseDataClient, product_id: str, payload: ProductUpdate
    ) -> Dict[str, Any]:
        update_data = payload.model_dump(exclude_unset=True)
        if "base_price" in update_data and update_data["base_price"] is not None:
            update_data["base_price"] = float(update_data["base_price"])

        if not update_data:
            return await ProductService.get_product(db, product_id)

        updated = await db.update(
            table="products",
            data=update_data,
            params={"id": f"eq.{product_id}"},
            single=True,
        )
        return updated

    @staticmethod
    async def delete_or_deactivate_product(
        db: SupabaseDataClient, product_id: str, hard_delete: bool = False
    ) -> Dict[str, Any]:
        if hard_delete:
            await db.delete(table="products", params={"id": f"eq.{product_id}"})
            return {"ok": True, "message": "Product permanently deleted"}
        else:
            updated = await db.update(
                table="products",
                data={"is_active": False},
                params={"id": f"eq.{product_id}"},
                single=True,
            )
            return {"ok": True, "message": "Product deactivated", "product": updated}

    # Variants methods
    @staticmethod
    async def list_variants(db: SupabaseDataClient, product_id: str) -> List[Dict[str, Any]]:
        try:
            variants = await db.select(
                table="product_variants",
                columns="*",
                params={"product_id": f"eq.{product_id}"},
                order="created_at.asc",
            )
            return variants if isinstance(variants, list) else []
        except Exception:
            return []

    @staticmethod
    async def add_variant(
        db: SupabaseDataClient, product_id: str, payload: ProductVariantCreate
    ) -> Dict[str, Any]:
        v_dict = payload.model_dump(exclude_unset=True)
        v_dict["product_id"] = product_id
        v_dict["price_modifier"] = float(v_dict.get("price_modifier", 0.0))

        if "cost_price" in v_dict and v_dict["cost_price"] is not None:
            v_dict["cost_price"] = float(v_dict["cost_price"])

        return await db.insert(table="product_variants", data=v_dict, single=True)

    @staticmethod
    async def update_variant(
        db: SupabaseDataClient, variant_id: str, payload: ProductVariantUpdate
    ) -> Dict[str, Any]:
        v_dict = payload.model_dump(exclude_unset=True)
        if "price_modifier" in v_dict and v_dict["price_modifier"] is not None:
            v_dict["price_modifier"] = float(v_dict["price_modifier"])
        if "cost_price" in v_dict and v_dict["cost_price"] is not None:
            v_dict["cost_price"] = float(v_dict["cost_price"])
        return await db.update(
            table="product_variants",
            data=v_dict,
            params={"id": f"eq.{variant_id}"},
            single=True,
        )

    @staticmethod
    async def delete_or_deactivate_variant(
        db: SupabaseDataClient, variant_id: str, hard_delete: bool = False
    ) -> Dict[str, Any]:
        if hard_delete:
            await db.delete(table="product_variants", params={"id": f"eq.{variant_id}"})
            return {"ok": True, "message": "Variant deleted"}
        else:
            updated = await db.update(
                table="product_variants",
                data={"is_active": False},
                params={"id": f"eq.{variant_id}"},
                single=True,
            )
            return {"ok": True, "message": "Variant deactivated", "variant": updated}
