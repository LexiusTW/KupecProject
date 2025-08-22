from typing import List, Optional
from pydantic import BaseModel


class MetalBase(BaseModel):
    name: str
    category: Optional[str] = None
    stamp: Optional[str] = None
    gost: Optional[str] = None
    material: Optional[str] = None
    city: Optional[str] = None
    supplier: Optional[str] = None
    diameter: Optional[float] = None
    thickness: Optional[float] = None
    width: Optional[float] = None
    length: Optional[float] = None
    price: Optional[float] = None

class MetalOut(MetalBase):
    id: int

class PaginatedMetal(BaseModel):
    items: List[MetalOut]
    total: int