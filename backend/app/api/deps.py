from typing import AsyncGenerator, Union, Optional

from fastapi import Depends, HTTPException, status, Request
from jose import JWTError, jwt
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.schemas.token import TokenPayload

from sqlalchemy.orm import Session as SyncSession
from app.crud.user import get_by_id_with_role as crud_get_by_id_with_role
from app.models.user import Buyer, Seller


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Асинхронная сессия БД на запрос.
    """
    async with AsyncSessionLocal() as session:
        yield session


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Union[Buyer, Seller]:
    """
    Достаёт access_token из HttpOnly cookie, валидирует JWT и возвращает текущего пользователя.
    """
    user = await get_current_user_optional(request, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[Union[Buyer, Seller]]:
    token: Optional[str] = request.cookies.get("access_token")
    if not token:
        return None

    credentials_exception = HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_data = TokenPayload(**payload)
        role = payload.get("role")
        user_id = int(token_data.sub) if token_data.sub is not None else None
        if user_id is None or role not in ("buyer", "seller"):
            raise credentials_exception
    except (JWTError, ValidationError, ValueError):
        raise credentials_exception

    holder = {"user": None}

    def _sync_get(sdb: SyncSession):
        holder["user"] = crud_get_by_id_with_role(sdb, role=role, user_id=user_id)

    await db.run_sync(_sync_get)
    user = holder["user"]

    if not user:
        return None
    return user
