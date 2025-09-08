from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, constr


class Role(str, Enum):
    ADMIN = "Администратор"
    BUYER = "Покупатель"
    SELLER = "Продавец"


class BuyerUserCreate(BaseModel):
    login: str
    password: constr(min_length=8)
    role: Role = Role.BUYER

class SellerUserCreate(BaseModel):
    login: str
    password: constr(min_length=8)
    role: Role = Role.SELLER
    inn: Optional[str] = None
    director_name: Optional[str] = None
    phone_number: Optional[str] = None
    legal_address: Optional[str] = None


class UserSchema(BaseModel):
    id: int
    login: str
    role: Role
    is_active: bool

    class SomeSchema(BaseModel):
        model_config = ConfigDict(from_attributes=True)