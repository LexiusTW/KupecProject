from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models.oauth_account import OAuthAccount

def get_by_provider_user_id(db: Session, *, provider: str, provider_user_id: str) -> Optional[OAuthAccount]:
    """
    Находит OAuth аккаунт по названию провайдера и ID пользователя у этого провайдера.
    """
    return (
        db.query(OAuthAccount)
        .filter(OAuthAccount.provider == provider, OAuthAccount.provider_user_id == provider_user_id)
        .first()
    )

def create(db: Session, *, obj_in: Dict[str, Any]) -> OAuthAccount:
    """
    Создает новую запись OAuth аккаунта.
    """
    db_obj = OAuthAccount(**obj_in)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def update(db: Session, *, db_obj: OAuthAccount, obj_in: Dict[str, Any]) -> OAuthAccount:
    """
    Обновляет запись OAuth аккаунта (например, токены).
    """
    for field, value in obj_in.items():
        setattr(db_obj, field, value)

    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj
