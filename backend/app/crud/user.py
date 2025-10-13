from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.models.organization import Organization
from app.schemas.user import UserCreate, UserCreateByAdmin, UserUpdateByAdmin
from app.crud import organization as crud_organization

def get_by_login(db: Session, *, login: str) -> Optional[User]:
    return db.query(User).options(joinedload(User.organization)).filter(User.login == login).first()


def get_by_email(db: Session, *, email: str) -> Optional[User]:
    return db.query(User).options(joinedload(User.organization)).filter(User.email == email).first()


def get_by_id(db: Session, *, user_id: int) -> Optional[User]:
    return db.query(User).options(joinedload(User.organization)).filter(User.id == user_id).first()


def get_all(db: Session) -> List[User]:
    return db.query(User).options(joinedload(User.organization)).order_by(User.id).all()


def get_by_organization(db: Session, *, organization_id: int) -> List[User]:
    return db.query(User).options(joinedload(User.organization)).filter(User.organization_id == organization_id).order_by(User.id).all()


def get_by_parent(db: Session, *, parent_id: int) -> List[User]:
    return db.query(User).options(joinedload(User.organization)).filter(User.parent_id == parent_id).order_by(User.id).all()


def create_user(db: Session, *, obj_in: UserCreate) -> User:
    # 1. Найти или создать организацию
    organization = crud_organization.get_by_inn(db, inn=obj_in.organization.inn)
    if not organization:
        organization = crud_organization.create(db, obj_in=obj_in.organization)

    # 2. Создать пользователя
    db_obj = User(
        login=obj_in.login,
        email=obj_in.email,
        hashed_password=get_password_hash(obj_in.password),
        employee_name=obj_in.employee_name,
        phone_number=obj_in.phone_number,
        is_active=True,
        role=obj_in.role.value,
        organization_id=organization.id
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj, attribute_names=['organization'])
    return db_obj


def create_user_by_admin(db: Session, *, obj_in: UserCreateByAdmin, creator: User) -> User:
    if not creator.organization_id:
        raise ValueError("Создающий админ должен быть привязан к организации")

    db_obj = User(
        login=obj_in.login,
        email=obj_in.email,
        hashed_password=get_password_hash(obj_in.password),
        employee_name=obj_in.employee_name,
        phone_number=obj_in.phone_number,
        is_active=True,
        role=obj_in.role.value,
        parent_id=obj_in.parent_id,
        organization_id=creator.organization_id
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj, attribute_names=['organization'])
    return db_obj


def authenticate(db: Session, *, login: str, password: str) -> Optional[User]:
    user = db.query(User).options(joinedload(User.organization)).filter(or_(User.login == login, User.email == login)).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

def update(db: Session, *, db_obj: User, obj_in: UserUpdateByAdmin | Dict[str, Any]) -> User:
    if isinstance(obj_in, dict):
        update_data = obj_in
    else:
        update_data = obj_in.model_dump(exclude_unset=True)

    # Проверяем, есть ли поле role в обновлении и если есть, то устанавливаем его значение
    if 'role' in update_data and update_data['role'] is not None:
        update_data['role'] = update_data['role'].value

    for field, value in update_data.items():
        setattr(db_obj, field, value)

    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def remove(db: Session, *, db_obj: User):
    db.delete(db_obj)
    db.commit()