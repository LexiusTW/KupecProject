from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime

Role = Literal["buyer", "seller"]

class RequestItemBase(BaseModel):
    # общий блок
    kind: Optional[Literal["metal", "generic"]] = None
    category: Optional[str] = None
    quantity: Optional[float] = Field(default=None, ge=0)
    comment: Optional[str] = None

    # НОВОЕ: универсальные «строковые» поля
    size: Optional[str] = None   # для metal (строковой размер на витрину)
    dims: Optional[str] = None   # для generic (свободные характеристики)
    uom: Optional[str] = None    # для generic (ед. изм.)

    # metal
    stamp: Optional[str] = None
    state_standard: Optional[str] = None
    thickness: Optional[float] = Field(default=None, ge=0)
    length: Optional[float] = Field(default=None, ge=0)
    width: Optional[float] = Field(default=None, ge=0)
    diameter: Optional[float] = Field(default=None, ge=0)
    allow_analogs: Optional[bool] = None

    # generic
    name: Optional[str] = None
    note: Optional[str] = None

    model_config = {"from_attributes": True}

class RequestItemCreate(RequestItemBase):
    """Элементы, которые прилетают с фронта при создании заявки.
    kind можно не присылать — мы определим на бэке по заполненным полям.
    """
    pass

class RequestCreate(BaseModel):
    items: List[RequestItemCreate]
    comment: Optional[str] = None
    delivery_at: Optional[datetime] = None
    delivery_address: Optional[str] = None  # если фронт когда-то пришлёт адрес прямо тут
    counterparty_id: Optional[int] = None   # ID контрагента
    model_config = {"from_attributes": True}

class RequestItemOut(RequestItemBase):
    id: int
    model_config = {"from_attributes": True}

class CounterpartyInRequest(BaseModel):
    id: int
    short_name: str
    model_config = {"from_attributes": True}

class RequestOut(BaseModel):
    id: int
    comment: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_at: Optional[datetime] = None
    created_at: datetime
    items: List[RequestItemOut]
    counterparty: Optional[CounterpartyInRequest] = None
    model_config = {"from_attributes": True}
