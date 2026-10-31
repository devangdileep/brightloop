from typing import Any, Optional
from pydantic import BaseModel


class SuccessResponse(BaseModel):
    ok: bool = True
    message: Optional[str] = None


class IdResponse(BaseModel):
    ok: bool = True
    id: str
    message: Optional[str] = None
