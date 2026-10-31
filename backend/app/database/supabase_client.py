import json
from typing import Any, Dict, List, Optional, Tuple, Union
import httpx
from app.core.config import settings
from app.core.exceptions import AppException, BadRequestException, ConflictException, NotFoundException


class SupabaseDataClient:
    """
    Request-scoped client for communicating with Supabase PostgREST Data API.
    Forwards the user's JWT or server secret in the Authorization header.
    Respects Supabase RLS policies.
    """

    def __init__(self, token: Optional[str] = None, is_service_role: bool = False):
        self.base_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1"
        self.auth_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"
        self.is_service_role = is_service_role

        if is_service_role:
            if not settings.SUPABASE_SERVICE_ROLE_KEY:
                raise AppException(
                    status_code=500,
                    detail="SUPABASE_SERVICE_ROLE_KEY is not configured for privileged operation",
                    error_code="CONFIGURATION_ERROR",
                )
            self.api_key = settings.SUPABASE_SERVICE_ROLE_KEY
            self.auth_header = f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"
        else:
            self.api_key = settings.anon_key
            self.auth_header = f"Bearer {token}" if token else f"Bearer {settings.anon_key}"

    def _headers(
        self,
        prefer: Optional[str] = None,
        single: bool = False,
        count: Optional[str] = None,
    ) -> Dict[str, str]:
        h = {
            "apikey": self.api_key,
            "Authorization": self.auth_header,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        prefer_parts = []
        if prefer:
            prefer_parts.append(prefer)
        if count:
            prefer_parts.append(f"count={count}")
        if prefer_parts:
            h["Prefer"] = ", ".join(prefer_parts)

        if single:
            h["Accept"] = "application/vnd.pgrst.object+json"
        return h

    def _handle_error(self, resp: httpx.Response, context: str = "") -> None:
        if resp.status_code < 400:
            return

        detail = resp.text
        code = "DATABASE_ERROR"
        try:
            err_json = resp.json()
            detail = err_json.get("message") or err_json.get("error_description") or err_json.get("hint") or resp.text
            code = err_json.get("code") or code
        except Exception:
            pass

        if resp.status_code == 404:
            raise NotFoundException(detail=f"{context}: Resource not found" if context else detail)
        elif resp.status_code == 409:
            raise ConflictException(detail=f"{context}: {detail}" if context else detail)
        elif resp.status_code == 400 or resp.status_code == 422:
            raise BadRequestException(detail=f"{context}: {detail}" if context else detail)
        else:
            raise AppException(
                status_code=resp.status_code,
                detail=f"{context}: {detail}" if context else detail,
                error_code=code,
            )

    async def select(
        self,
        table: str,
        columns: str = "*",
        params: Optional[Dict[str, Any]] = None,
        order: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        single: bool = False,
        count: Optional[str] = None,
    ) -> Union[Dict[str, Any], List[Dict[str, Any]], Tuple[List[Dict[str, Any]], int]]:
        url = f"{self.base_url}/{table}"
        query_params: Dict[str, Any] = {"select": columns}
        if params:
            query_params.update(params)
        if order:
            query_params["order"] = order
        if limit is not None:
            query_params["limit"] = limit
        if offset is not None:
            query_params["offset"] = offset

        headers = self._headers(single=single, count=count)
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=query_params, headers=headers)
            self._handle_error(resp, context=f"Error reading from {table}")

            if count:
                # Content-Range: 0-9/42
                content_range = resp.headers.get("Content-Range", "")
                total_count = 0
                if "/" in content_range:
                    try:
                        total_count = int(content_range.split("/")[1])
                    except (ValueError, IndexError):
                        total_count = 0
                return resp.json(), total_count

            return resp.json()

    async def insert(
        self,
        table: str,
        data: Union[Dict[str, Any], List[Dict[str, Any]]],
        upsert: bool = False,
        on_conflict: Optional[str] = None,
        single: bool = True,
    ) -> Union[Dict[str, Any], List[Dict[str, Any]]]:
        url = f"{self.base_url}/{table}"
        prefer_parts = ["return=representation"]
        if upsert:
            prefer_parts.append("resolution=merge-duplicates")
        prefer = ", ".join(prefer_parts)

        query_params = {}
        if on_conflict:
            query_params["on_conflict"] = on_conflict

        headers = self._headers(prefer=prefer, single=single if isinstance(data, dict) else False)
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=data, params=query_params, headers=headers)
            self._handle_error(resp, context=f"Error inserting into {table}")
            return resp.json()

    async def update(
        self,
        table: str,
        data: Dict[str, Any],
        params: Dict[str, Any],
        single: bool = True,
    ) -> Union[Dict[str, Any], List[Dict[str, Any]]]:
        url = f"{self.base_url}/{table}"
        headers = self._headers(prefer="return=representation", single=single)
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.patch(url, json=data, params=params, headers=headers)
            self._handle_error(resp, context=f"Error updating {table}")
            return resp.json()

    async def delete(
        self,
        table: str,
        params: Dict[str, Any],
    ) -> bool:
        url = f"{self.base_url}/{table}"
        headers = self._headers()
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.delete(url, params=params, headers=headers)
            self._handle_error(resp, context=f"Error deleting from {table}")
            return True

    async def rpc(
        self,
        fn_name: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Any:
        url = f"{self.base_url}/rpc/{fn_name}"
        headers = self._headers()
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=params or {}, headers=headers)
            self._handle_error(resp, context=f"Error calling RPC {fn_name}")
            return resp.json()


def get_user_db_client(token: str) -> SupabaseDataClient:
    return SupabaseDataClient(token=token, is_service_role=False)


def get_admin_db_client() -> SupabaseDataClient:
    return SupabaseDataClient(is_service_role=True)
