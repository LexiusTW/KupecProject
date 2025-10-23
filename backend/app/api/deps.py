from typing import AsyncGenerator, Union, Optional
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status, Request
from jose import JWTError, jwt
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session as SyncSession
import httpx

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.schemas.token import TokenPayload
from app.schemas.user import Role
from app.crud import user as crud_user, oauth_account as crud_oauth_account
from app.models.user import User


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Асинхронная сессия БД на запрос.
    """
    async with AsyncSessionLocal() as session:
        yield session


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
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
) -> Optional[User]:
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
        if user_id is None or role not in [r.value.lower() for r in Role]:
            raise credentials_exception
    except (JWTError, ValidationError, ValueError):
        raise credentials_exception

    holder = {"user": None}

    def _sync_get(sdb: SyncSession):
        user = crud_user.get_by_id(sdb, user_id=user_id)
        # Явно проверяем роль из токена с ролью из БД
        if user and user.role.lower() == role:
            holder["user"] = user

    await db.run_sync(_sync_get)
    user = holder["user"]

    if not user:
        return None
    return user


async def get_refreshed_user_google_creds(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Проверяет токен доступа Google. Если он истек, обновляет его, используя refresh_token.
    Возвращает пользователя с актуальными учетными данными.
    """
    # Загружаем связанные oauth_accounts, если они еще не загружены
    # В асинхронном контексте это нужно делать явно
    def _sync_load_oauth(sdb: SyncSession):
        sdb.refresh(current_user, attribute_names=["oauth_accounts"])

    await db.run_sync(_sync_load_oauth)

    google_account = next((acc for acc in current_user.oauth_accounts if acc.provider == 'google'), None)

    if not google_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Аккаунт Google не подключен для этого пользователя.",
        )

    # Проверяем, истек ли токен
    if google_account.token_expiry and google_account.token_expiry > datetime.now(timezone.utc):
        return current_user # Токен еще действителен

    # Если токен истек, но нет refresh_token, мы не можем его обновить
    if not google_account.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Срок действия токена Google истек, и нет refresh-токена для обновления.",
        )

    # Токен истек, пытаемся его обновить
    async with httpx.AsyncClient() as client:
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": google_account.refresh_token,
            "grant_type": "refresh_token",
        }
        token_response = await client.post(token_url, data=data)

    if token_response.status_code != 200:
        def _sync_clear_tokens(sdb: SyncSession):
            update_data = {"access_token": None, "refresh_token": None, "token_expiry": None}
            crud_oauth_account.update(sdb, db_obj=google_account, obj_in=update_data)
        
        await db.run_sync(_sync_clear_tokens)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Не удалось обновить токен Google. Пожалуйста, переподключите аккаунт. Ошибка: {token_response.text}",
        )

    token_data = token_response.json()
    new_access_token = token_data["access_token"]
    new_expires_in = token_data["expires_in"]
    new_expiry_date = datetime.now(timezone.utc) + timedelta(seconds=new_expires_in)

    # Обновляем oauth_account в БД с новыми токенами
    def _sync_update_tokens(sdb: SyncSession):
        update_data = {
            "access_token": new_access_token,
            "token_expiry": new_expiry_date,
        }
        crud_oauth_account.update(sdb, db_obj=google_account, obj_in=update_data)

    await db.run_sync(_sync_update_tokens)
    
    # Обновляем объект current_user для текущего запроса
    google_account.access_token = new_access_token
    google_account.token_expiry = new_expiry_date

    return current_user

async def get_refreshed_user_yandex_creds(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Проверяет токен доступа Yandex. Если он истек, обновляет его, используя refresh_token.
    Возвращает пользователя с актуальными учетными данными.
    """
    def _sync_load_oauth(sdb: SyncSession):
        sdb.refresh(current_user, attribute_names=["oauth_accounts"])

    await db.run_sync(_sync_load_oauth)

    yandex_account = next((acc for acc in current_user.oauth_accounts if acc.provider == 'yandex'), None)

    if not yandex_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Аккаунт Yandex не подключен для этого пользователя.",
        )

    if yandex_account.token_expiry and yandex_account.token_expiry > datetime.now(timezone.utc):
        return current_user

    if not yandex_account.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Срок действия токена Yandex истек, и нет refresh-токена для обновления.",
        )

    async with httpx.AsyncClient() as client:
        token_url = "https://oauth.yandex.ru/token"
        data = {
            "refresh_token": yandex_account.refresh_token,
            "grant_type": "refresh_token",
        }
        auth = (settings.YANDEX_CLIENT_ID, settings.YANDEX_CLIENT_SECRET)
        token_response = await client.post(token_url, data=data, auth=auth)

    if token_response.status_code != 200:
        def _sync_clear_tokens(sdb: SyncSession):
            update_data = {"access_token": None, "refresh_token": None, "token_expiry": None}
            crud_oauth_account.update(sdb, db_obj=yandex_account, obj_in=update_data)
        
        await db.run_sync(_sync_clear_tokens)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Не удалось обновить токен Yandex. Пожалуйста, переподключите аккаунт. Ошибка: {token_response.text}",
        )

    token_data = token_response.json()
    new_access_token = token_data["access_token"]
    new_expires_in = token_data["expires_in"]
    new_expiry_date = datetime.now(timezone.utc) + timedelta(seconds=new_expires_in)

    def _sync_update_tokens(sdb: SyncSession):
        update_data = {
            "access_token": new_access_token,
            "token_expiry": new_expiry_date,
        }
        # Яндекс может вернуть новый refresh_token
        if "refresh_token" in token_data:
            update_data["refresh_token"] = token_data["refresh_token"]
        crud_oauth_account.update(sdb, db_obj=yandex_account, obj_in=update_data)

    await db.run_sync(_sync_update_tokens)
    
    yandex_account.access_token = new_access_token
    yandex_account.token_expiry = new_expiry_date
    if "refresh_token" in token_data:
        yandex_account.refresh_token = token_data["refresh_token"]

    return current_user
