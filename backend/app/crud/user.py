# app/crud/user.py
from typing import Optional
from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.models.user import User

def get_by_login(db: Session, *, login: str) -> Optional[User]:
    return db.query(User).filter(User.login == login).first()

def get_by_username(db: Session, *, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()

def get_by_id_with_role(db: Session, *, role: str, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id, User.role == role).first()

def get_by_id(db: Session, *, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

def create_user(db: Session, *, login: str, password: str, role: str = "client", **kwargs) -> User:
    db_obj = User(
        login=login,
        hashed_password=get_password_hash(password),
        role=role,
        is_active=True,
        **kwargs
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def create_buyer(db: Session, *, login: str, password: str, **kwargs) -> User:
    return create_user(db, login=login, password=password, role="buyer", **kwargs)

def create_seller(
    db: Session, *,
    login: str, password: str,
    inn: str, director_name: str, phone_number: str, legal_address: str, **kwargs
) -> User:
    return create_user(
        db, 
        login=login, 
        password=password, 
        role="seller",
        inn=inn,
        director_name=director_name,
        phone_number=phone_number,
        legal_address=legal_address,
        **kwargs
    )

def authenticate(db: Session, *, login: str, password: str) -> Optional[User]:
    user = get_by_login(db, login=login)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

def update_user_address(db: Session, *, user_id: int, delivery_address: str) -> Optional[User]:
    user = db.query(User).get(user_id)
    if not user:
        return None
    user.delivery_address = delivery_address
    db.commit()
    db.refresh(user)
    return user
