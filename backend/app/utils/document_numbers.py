from typing import Optional
from app.database.supabase_client import SupabaseDataClient


async def generate_document_number(db: SupabaseDataClient, kind: str) -> str:
    """
    Calls public.next_document_number(p_kind) via PostgREST RPC.
    Returns strings like INV-2026-0001 or QUO-2026-0001.
    """
    result = await db.rpc("next_document_number", {"p_kind": kind})
    return str(result)
