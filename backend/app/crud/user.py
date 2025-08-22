# app/crud/user.py
from typing import Optional, Union
from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.models.user import Buyer, Seller

UserLike = Union[Buyer, Seller]

def get_by_login(db: Session, *, login: str) -> Optional[UserLike]:
    buyer = db.query(Buyer).filter(Buyer.login == login).first()
    if buyer:
        return buyer
    seller = db.query(Seller).filter(Seller.login == login).first()
    return seller

def get_by_id_with_role(db: Session, *, role: str, user_id: int) -> Optional[UserLike]:
    if role == "buyer":
        return db.query(Buyer).get(user_id)
    if role == "seller":
        return db.query(Seller).get(user_id)
    return None

def create_buyer(db: Session, *, login: str, password: str) -> Buyer:
    db_obj = Buyer(
        login=login,
        hashed_password=get_password_hash(password),
        is_active=True,
        role="Покупатель",
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def create_seller(
    db: Session, *,
    login: str, password: str,
    inn: str, director_name: str, phone_number: str, legal_address: str
) -> Seller:
    db_obj = Seller(
        login=login,
        hashed_password=get_password_hash(password),
        inn=inn,
        director_name=director_name,
        phone_number=phone_number,
        legal_address=legal_address,
        is_active=True,
        role="Продавец",
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def authenticate(db: Session, *, login: str, password: str) -> Optional[UserLike]:
    user = get_by_login(db, login=login)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
