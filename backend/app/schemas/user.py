from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, constr, field_validator
from datetime import datetime

from .organization import OrganizationCreate, OrganizationSchema

class Role(str, Enum):
    DIRECTOR = "Директор"
    HEAD_OF_SALES = "РОП"
    MANAGER = "Менеджер"
    SUPPLY_MANAGER = "Снабженец"

# Схема для создания пользователя через публичную регистрацию
class UserCreate(BaseModel):
    login: str
    password: constr(min_length=8) #type: ignore
    email: str
    employee_name: str
    phone_number: Optional[str] = None
    # При регистрации новой компании, ожидаем полные данные
    organization: OrganizationCreate
    # Роль при самостоятельной регистрации обычно фиксирована или выбирается из ограниченного списка
    role: Role = Role.DIRECTOR
    
# Схема для создания пользователя админом (Директор или РОП)
class UserCreateByAdmin(BaseModel):
    login: str
    password: constr(min_length=8) #type: ignore
    email: str
    employee_name: str
    phone_number: Optional[str] = None
    role: Role
    parent_id: Optional[int] = None # Для связи Менеджера с РОПом

# Базовая схема для вывода данных о пользователе
class UserBase(BaseModel):
    id: int
    login: str
    email: str
    role: Role
    employee_name: str
    phone_number: Optional[str] = None
    is_active: bool
    parent_id: Optional[int] = None
    created_at: datetime
    organization: OrganizationSchema

    model_config = ConfigDict(from_attributes=True)

# Схема для вывода списка пользователей
class UserList(BaseModel):
    users: List[UserBase]

# Схема для смены пароля
class UserChangePassword(BaseModel):
    old_password: str
    new_password: constr(min_length=8) #type: ignore
    new_password_confirm: constr(min_length=8) #type: ignore

    @field_validator('new_password_confirm')
    def passwords_match(cls, v, info):
        if 'new_password' in info.data and v != info.data['new_password']:
            raise ValueError('Пароли не совпадают')
        return v

# Схема для обновления профиля
class UserProfileUpdate(BaseModel):
    # Это схема для обновления данных самим пользователем.
    # Организационные данные здесь не меняются.
    logo_url: Optional[str] = None

# Схема для обновления пользователя админом (Директор или РОП)
class UserUpdateByAdmin(BaseModel):
    login: Optional[str] = None
    email: Optional[str] = None
    employee_name: Optional[str] = None
    phone_number: Optional[str] = None
    role: Optional[Role] = None
    parent_id: Optional[int] = None
    is_active: Optional[bool] = None
