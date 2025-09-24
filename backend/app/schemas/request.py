from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime, date
from uuid import UUID

Role = Literal["buyer", "seller"]

class RequestItemBase(BaseModel):
    # общий блок
    kind: Optional[Literal["metal", "generic"]] = None
    category: Optional[str] = None
    quantity: Optional[float] = Field(default=None, ge=0)
    comment: Optional[str] = None

    # универсальные «строковые» поля
    size: Optional[str] = None   # для metal (строковой размер на витрину)
    dims: Optional[str] = None   # для generic (свободные характеристики)
    unit: Optional[str] = None    # для generic (ед. изм.)

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
    delivery_at: Optional[date] = None
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

class OfferItemCreate(BaseModel):
    request_item_id: int
    price: float
    total_price: Optional[float] = None
    is_analogue: bool = False

    quantity: Optional[float] = None
    unit: Optional[str] = None

    # generic
    name: Optional[str] = None
    description: Optional[str] = None # Размеры, характеристики

    # металлопрокат
    category: Optional[str] = None
    size: Optional[str] = None
    stamp: Optional[str] = None # Марка
    state_standard: Optional[str] = None  # ГОСТ

class OfferCreate(BaseModel):
    supplier_id: Optional[int] = None
    comment: Optional[str] = None
    items: List[OfferItemCreate]
    delivery_option: str
    vat_option: str
    invoice_expires_at: date

class SupplierOut(BaseModel):
    id: int
    short_name: str
    model_config = {"from_attributes": True}

class OfferItemOut(BaseModel):
    id: int
    request_item_id: int
    price: float
    total_price: Optional[float] = None
    is_analogue: bool

    quantity: Optional[float] = None
    unit: Optional[str] = None

    # generic
    name: Optional[str] = None
    description: Optional[str] = None

    # металлопрокат
    category: Optional[str] = None
    size: Optional[str] = None
    stamp: Optional[str] = None
    state_standard: Optional[str] = None

    model_config = {"from_attributes": True}


class OfferOut(BaseModel):
    id: int
    supplier: SupplierOut
    comment: Optional[str] = None
    created_at: datetime
    items: List[OfferItemOut]
    delivery_option: str
    vat_option: str
    invoice_expires_at: date
    invoice_file_path: str
    contract_file_path: Optional[str] = None
    model_config = {"from_attributes": True}

class RequestOut(BaseModel):
    id: UUID
    display_id: int
    comment: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_at: Optional[date] = None
    created_at: datetime
    status: str
    winner_offer_id: Optional[int] = None
    items: List[RequestItemOut]
    offers: List[OfferOut]
    counterparty: Optional[CounterpartyInRequest] = None
    model_config = {"from_attributes": True}
