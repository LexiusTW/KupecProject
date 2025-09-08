from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

class SearchResultItem(BaseModel):
    id: int
    name: Optional[str] = None
    category: Optional[str] = None
    stamp: Optional[str] = None
    gost: Optional[str] = None
    city: Optional[str] = None
    thickness: Optional[float] = None
    length: Optional[float] = None
    width: Optional[float] = None
    diameter: Optional[float] = None
    price: Optional[float] = None
    supplier: Optional[str]
    material: Optional[str] = None

    class SomeSchema(BaseModel):
        model_config = ConfigDict(from_attributes=True)

class SearchResult(BaseModel):
    items: List[SearchResultItem]
    total: int
