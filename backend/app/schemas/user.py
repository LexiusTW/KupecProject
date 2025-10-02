from enum import Enum
from typing import Optional, Dict, Any

from pydantic import BaseModel, ConfigDict, constr


class Role(str, Enum):
    DIRECTOR = "Директор"
    HEAD_OF_SALES = "РОП"
    MANAGER = "Менеджер"
    SUPPLY_MANAGER = "Снабженец"


class UserCreate(BaseModel):
    login: str
    password: constr(min_length=8)  # type: ignore
    role: Role
    email: str
    employee_name: str
    inn: Optional[str] = None
    company_name: Optional[str] = None
    phone_number: Optional[str] = None
    director_name: Optional[str] = None
    legal_address: Optional[str] = None
    ogrn: Optional[str] = None
    kpp: Optional[str] = None
    okpo: Optional[str] = None
    okato_oktmo: Optional[str] = None
    bank_account: Optional[str] = None
    correspondent_account: Optional[str] = None
    bic: Optional[str] = None
    bank_name: Optional[str] = None

class UserProfileUpdate(BaseModel):
    delivery_address: Optional[str] = None
    email_footer: Optional[str] = None
    logo_url: Optional[str] = None

from pydantic import ValidationError, field_validator

class UserChangePassword(BaseModel):
    old_password: str
    new_password: constr(min_length=8) #type: ignore
    new_password_confirm: constr(min_length=8) #type: ignore

    @field_validator('new_password_confirm')
    @classmethod
    def passwords_match(cls, v, info):
        if 'new_password' in info.data and v != info.data['new_password']:
            raise ValueError('Passwords do not match')
        return v

class UserSchema(BaseModel):
    id: int
    login: str
    email: str
    role: Role
    is_active: bool
    delivery_address: Optional[str] = None
    email_footer: Optional[str] = None
    inn: Optional[str] = None
    company_name: Optional[str] = None
    director_name: Optional[str] = None
    phone_number: Optional[str] = None
    legal_address: Optional[str] = None
    ogrn: Optional[str] = None
    kpp: Optional[str] = None
    okpo: Optional[str] = None
    okato_oktmo: Optional[str] = None
    logo_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)