# backend/app/schemas/counterparty.py
from pydantic import BaseModel, ConfigDict, constr, EmailStr
from typing import Optional

class CounterpartyBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # Основное
    short_name: constr(strip_whitespace=True, min_length=2, max_length=255) #type: ignore
    legal_address: constr(strip_whitespace=True, min_length=3, max_length=500) #type: ignore
    ogrn: Optional[constr(pattern=r'^\d{13}(\d{2})?$', strip_whitespace=True)] = None #type: ignore
    inn: constr(pattern=r'^\d{10}(\d{2})?$', strip_whitespace=True) #type: ignore
    kpp: Optional[constr(pattern=r'^\d{9}$')] = None #type: ignore 
    okpo: Optional[constr(pattern=r'^\d{8}(\d{2})?$')] = None #type: ignore
    okato: Optional[constr(strip_whitespace=True, min_length=1, max_length=20)] = None #type: ignore

    # Банк
    bank_account: Optional[constr(pattern=r'^\d{20}$')] = None #type: ignore
    bank_bik: Optional[constr(pattern=r'^\d{9}$')] = None #type: ignore 
    bank_name: Optional[constr(strip_whitespace=True, min_length=2, max_length=255)] = None #type: ignore
    bank_corr: Optional[constr(pattern=r'^\d{20}$')] = None #type: ignore

    # Контактные данные
    director: constr(strip_whitespace=True, min_length=2, max_length=255) #type: ignore
    phone: constr(strip_whitespace=True, min_length=5, max_length=50) #type: ignore
    email: EmailStr

class CounterpartyCreate(CounterpartyBase):
    pass

class CounterpartyUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    short_name: Optional[constr(strip_whitespace=True, min_length=2, max_length=255)] = None #type: ignore
    legal_address: Optional[constr(strip_whitespace=True, min_length=3, max_length=500)] = None #type: ignore
    ogrn: Optional[constr(pattern=r'^\d{13}(\d{2})?$')] = None #type: ignore
    inn: Optional[constr(pattern=r'^\d{10}(\d{2})?$')] = None #type: ignore
    kpp: Optional[constr(pattern=r'^\d{9}$')] = None #type: ignore
    okpo: Optional[constr(pattern=r'^\d{8}(\d{2})?$')] = None #type: ignore
    okato: Optional[constr(strip_whitespace=True, min_length=1, max_length=20)] = None #type: ignore

    bank_account: Optional[constr(pattern=r'^\d{20}$')] = None #type: ignore
    bank_bik: Optional[constr(pattern=r'^\d{9}$')] = None #type: ignore
    bank_name: Optional[constr(strip_whitespace=True, min_length=2, max_length=255)] = None #type: ignore
    bank_corr: Optional[constr(pattern=r'^\d{20}$')] = None #type: ignore

    director: Optional[constr(strip_whitespace=True, min_length=2, max_length=255)] = None #type: ignore
    phone: Optional[constr(strip_whitespace=True, min_length=5, max_length=50)] = None #type: ignore
    email: Optional[EmailStr] = None

class CounterpartyOut(CounterpartyBase):
    id: int