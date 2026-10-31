import time
from dataclasses import dataclass
from typing import Dict, Optional, Tuple
import httpx
from app.core.config import settings
from app.core.exceptions import UnauthorizedException
from app.core.permissions import Role


@dataclass
class AuthenticatedUser:
    id: str
    email: str
    role: Role
    token: str
    full_name: Optional[str] = None


# In-memory cache for validated tokens: token -> (user_id, email, full_name, expiry_timestamp)
_TOKEN_CACHE: Dict[str, Tuple[str, str, Optional[str], float]] = {}
CACHE_TTL_SECONDS = 30.0


async def verify_supabase_token(token: str) -> Tuple[str, str, Optional[str]]:
    """
    Validates the Supabase access token via Supabase Auth API.
    Returns (user_id, email, full_name).
    """
    now = time.time()
    if token in _TOKEN_CACHE:
        user_id, email, full_name, exp = _TOKEN_CACHE[token]
        if now < exp:
            return user_id, email, full_name
        else:
            del _TOKEN_CACHE[token]

    auth_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": settings.anon_key,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(auth_url, headers=headers)
            if resp.status_code != 200:
                raise UnauthorizedException("Invalid, expired, or revoked Supabase access token")

            data = resp.json()
            user_id = data.get("id")
            email = data.get("email", "")
            user_meta = data.get("user_metadata") or {}
            full_name = user_meta.get("full_name")

            if not user_id:
                raise UnauthorizedException("Malformed user response from Supabase Auth")

            # Cache token for CACHE_TTL_SECONDS
            _TOKEN_CACHE[token] = (user_id, email, full_name, now + CACHE_TTL_SECONDS)
            return user_id, email, full_name
    except httpx.RequestError as exc:
        raise UnauthorizedException(f"Failed to communicate with Supabase Auth: {str(exc)}")
