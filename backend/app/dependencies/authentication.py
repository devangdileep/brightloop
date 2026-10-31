from typing import Callable, Optional, Set
from fastapi import Depends, Header
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.permissions import ADMIN_ONLY, ALL_ROLES, Role, STAFF_AND_ADMIN
from app.core.security import AuthenticatedUser, verify_supabase_token
from app.database.supabase_client import SupabaseDataClient, get_user_db_client


async def get_token_from_header(authorization: Optional[str] = Header(None)) -> str:
    if not authorization:
        raise UnauthorizedException("Missing Authorization header")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise UnauthorizedException("Invalid Authorization header format. Expected 'Bearer <token>'")
    return parts[1]


async def get_current_user(token: str = Depends(get_token_from_header)) -> AuthenticatedUser:
    user_id, email, full_name_meta = await verify_supabase_token(token)

    # Fetch role directly from public.profiles using the user's client
    db = get_user_db_client(token)
    try:
        profile_data = await db.select(
            table="profiles",
            columns="role, full_name",
            params={"id": f"eq.{user_id}"},
            single=True,
        )
        role_str = profile_data.get("role", "customer") if isinstance(profile_data, dict) else "customer"
        db_full_name = profile_data.get("full_name") if isinstance(profile_data, dict) else None
    except Exception:
        # Default fallback role is customer if profile read fails
        role_str = "customer"
        db_full_name = None

    try:
        role = Role(role_str)
    except ValueError:
        role = Role.CUSTOMER

    return AuthenticatedUser(
        id=user_id,
        email=email,
        full_name=db_full_name or full_name_meta,
        role=role,
        token=token,
    )


async def get_db_client(user: AuthenticatedUser = Depends(get_current_user)) -> SupabaseDataClient:
    """Provides a request-scoped Supabase client bound to the current user's token."""
    return get_user_db_client(user.token)


def require_roles(allowed_roles: Set[Role]) -> Callable:
    async def role_checker(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role not in allowed_roles:
            raise ForbiddenException(f"Operation requires one of roles: {[r.value for r in allowed_roles]}")
        return user

    return role_checker


RequireAdmin = Depends(require_roles(ADMIN_ONLY))
RequireStaff = Depends(require_roles(STAFF_AND_ADMIN))
RequireAuthenticated = Depends(require_roles(ALL_ROLES))
