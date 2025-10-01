# app/crud/user.py
from typing import Optional, Union
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import UserProfileUpdate, UserCreate


def get_by_login(db: Session, *, login: str) -> Optional[User]:
    return db.query(User).filter(User.login == login).first()


def get_by_email(db: Session, *, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_by_id_with_role(db: Session, *, role: str, user_id: int) -> Optional[User]:
    user = db.query(User).get(user_id)
    if not user:
        return None

    # Mapping from JWT role to database role
    role_map = {
        "директор": "Директор",
        "роп": "РОП",
        "менеджер": "Менеджер",
        "снабженец": "Снабженец",
    }

    expected_role = role_map.get(role.lower())

    if user.role == expected_role:
        return user

    return None


def create_user(db: Session, *, obj_in: UserCreate) -> User:
    db_obj = User(
        login=obj_in.login,
        email=obj_in.email,
        hashed_password=get_password_hash(obj_in.password),
        inn=obj_in.inn,
        company_name=obj_in.company_name,
        director_name=obj_in.director_name or '',
        phone_number=obj_in.phone_number or '',
        legal_address=obj_in.legal_address or '',
        is_active=True,
        role=obj_in.role,
        ogrn=obj_in.ogrn,
        kpp=obj_in.kpp,
        okpo=obj_in.okpo,
        okato_oktmo=obj_in.okato_oktmo,
        employee_name=obj_in.employee_name,
        bank_account=obj_in.bank_account,
        correspondent_account=obj_in.correspondent_account,
        bic=obj_in.bic,
        bank_name=obj_in.bank_name
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def authenticate(db: Session, *, login: str, password: str) -> Optional[User]:
    user = db.query(User).filter(or_(User.login == login, User.email == login)).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
