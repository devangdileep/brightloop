from fastapi import APIRouter, Depends
from app.core.exceptions import NotFoundException
from app.core.security import AuthenticatedUser
from app.database.supabase_client import SupabaseDataClient
from app.dependencies.authentication import (
    RequireAdmin,
    RequireAuthenticated,
    get_db_client,
)
from app.schemas.settings import AppSettingsResponse, AppSettingsUpdate

router = APIRouter(prefix="/settings", tags=["Workspace Settings"])


@router.get("", response_model=AppSettingsResponse)
async def get_settings(
    user: AuthenticatedUser = RequireAuthenticated,
    db: SupabaseDataClient = Depends(get_db_client),
):
    data = await db.select(
        table="app_settings",
        columns="*",
        params={"id": "eq.1"},
        single=True,
    )
    if not data:
        raise NotFoundException("Settings not found")
    return AppSettingsResponse(**data)


@router.put("", response_model=AppSettingsResponse)
async def update_settings(
    payload: AppSettingsUpdate,
    admin_user: AuthenticatedUser = RequireAdmin,
    db: SupabaseDataClient = Depends(get_db_client),
):
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return await get_settings(user=admin_user, db=db)

    updated = await db.update(
        table="app_settings",
        data=update_data,
        params={"id": "eq.1"},
        single=True,
    )
    return AppSettingsResponse(**updated)
