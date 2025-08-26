from typing import List, Optional
from pydantic import BaseModel

class RequestItemCreate(BaseModel):
    # новый маркер типа позиции
    kind: Optional[str] = None  # 'metal' | 'generic' (если не передан — определим на бэке эвристикой)

    # общее
    category: Optional[str] = None     # metal: подкатегория металла; generic: пользовательская категория
    quantity: Optional[float] = None
    comment: Optional[str] = None

    # metal
    stamp: Optional[str] = None
    state_standard: Optional[str] = None
    city: Optional[str] = None
    thickness: Optional[float] = None
    length: Optional[float] = None
    width: Optional[float] = None
    diameter: Optional[float] = None
    allow_analogs: Optional[bool] = None

    # generic
    name: Optional[str] = None
    note: Optional[str] = None

class RequestCreate(BaseModel):
    items: List[RequestItemCreate]
    comment: Optional[str] = None

class RequestOut(BaseModel):
    id: int
