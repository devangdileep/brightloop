from typing import List, Optional
from pydantic import BaseModel


class BillingRunRequest(BaseModel):
    target_date: Optional[str] = None  # YYYY-MM-DD, defaults to today
    dry_run: bool = False


class BillingRunResponse(BaseModel):
    ok: bool = True
    processed: int
    created: int
    skipped: int
    failed: int
    invoices: List[str]
    errors: List[str]
    run_at: str
