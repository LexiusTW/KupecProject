from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr

class SupplierBase(BaseModel):
    short_name: str = Field(..., min_length=2)
    legal_address: str = Field(..., min_length=3)
    inn: str = Field(..., pattern=r"^\d{10}(\d{2})?$")
    kpp: Optional[str] = Field(..., pattern=r"^\d{9}$")
    ogrn: Optional[str] = Field(..., pattern=r"^\d{13}(\d{2})?$")
    okpo: Optional[str] = Field(..., pattern=r"^\d{8}(\d{2})?$")
    okato: Optional[str] = Field(..., pattern=r"^\d{1,20}$")
    contact_person: str = Field(..., min_length=2, description="ФИО контактного лица")
    phone_number: str = Field(..., min_length=5, description="Телефон контактного лица")
    email: EmailStr = Field(..., description="Email контактного лица")
    category: List[str] = Field(..., description="Категории поставщика (именительный падеж)")

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    # Все поля опциональны для частичного обновления
    short_name: Optional[str] = Field(None, min_length=2)
    legal_address: Optional[str] = Field(None, min_length=3)
    inn: Optional[str] = Field(None, pattern=r"^\d{10}(\d{2})?$")
    kpp: Optional[str] = Field(None, pattern=r"^\d{9}$")
    ogrn: Optional[str] = Field(None, pattern=r"^\d{13}(\d{2})?$")
    okpo: Optional[str] = Field(None, pattern=r"^\d{8}(\d{2})?$")
    okato: Optional[str] = Field(None, pattern=r"^\d{1,20}$")
    contact_person: Optional[str] = Field(None, min_length=2, description="ФИО контактного лица")
    phone_number: Optional[str] = Field(None, min_length=5, description="Телефон контактного лица")
    email: Optional[EmailStr] = Field(None, description="Email контактного лица")
    category: Optional[List[str]] = Field(None, description="Категории поставщика (именительный падеж)")

class SupplierOut(SupplierBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True