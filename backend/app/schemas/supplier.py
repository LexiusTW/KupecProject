from typing import Optional
from pydantic import BaseModel, Field, EmailStr

class SupplierBase(BaseModel):
    short_name: str = Field(..., min_length=2)
    legal_address: str = Field(..., min_length=3)
    inn: str = Field(..., pattern=r"^\d{10}(\d{2})?$")
    kpp: Optional[str] = Field(None, pattern=r"^\d{9}$")
    ogrn: Optional[str] = Field(None, pattern=r"^\d{13}(\d{2})?$")
    okpo: Optional[str] = Field(None, pattern=r"^\d{8}(\d{2})?$")
    okato: Optional[str] = Field(None, pattern=r"^\d{1,20}$")
    contact_person: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[EmailStr] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(SupplierBase):
    # Все поля делаем опциональными для частичного обновления
    short_name: Optional[str] = Field(None, min_length=2)
    legal_address: Optional[str] = Field(None, min_length=3)
    inn: Optional[str] = Field(None, pattern=r"^\d{10}(\d{2})?$")

class SupplierOut(SupplierBase):
    id: int
    buyer_id: int

    class Config:
        from_attributes = True