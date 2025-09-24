from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, constr


class Role(str, Enum):
    ADMIN = "Администратор"
    BUYER = "Покупатель"
    SELLER = "Продавец"


class BuyerUserCreate(BaseModel):
    login: str
    password: constr(min_length=8) #type: ignore
    role: Role = Role.BUYER

class SellerUserCreate(BaseModel):
    login: str
    password: constr(min_length=8) #type: ignore
    role: Role = Role.SELLER
    inn: Optional[str] = None
    director_name: Optional[str] = None
    phone_number: Optional[str] = None
    legal_address: Optional[str] = None

class UserProfileUpdate(BaseModel):
    delivery_address: Optional[str] = None
    email_footer: Optional[str] = None

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
    role: Role
    is_active: bool
    delivery_address: Optional[str] = None
    email_footer: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)