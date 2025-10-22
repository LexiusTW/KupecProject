from pydantic import BaseModel
from typing import Optional


class DepartmentCreate(BaseModel):
    name: str
    rop_id: Optional[int] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    rop_id: Optional[int] = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    rop_id: Optional[int] = None

    model_config = {"from_attributes": True}


