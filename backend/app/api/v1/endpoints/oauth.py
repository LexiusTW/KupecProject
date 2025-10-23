import httpx
from fastapi import APIRouter, Request, Response, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session as SyncSession
from urllib.parse import urlencode
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.api import deps
from app.models.user import User
from app.crud import user as crud_user, oauth_account as crud_oauth_account
from app.core.security import create_access_token, create_refresh_token
from app.api.v1.endpoints.auth import _set_cookie

router = APIRouter()


@router.get("/login/google", tags=["oauth"])
def login_google():
    """
    Перенаправление на сервер Google OAuth 2.0 для инициации аутентификации.
    Запрашивает доступ к email, профилю и почте Gmail.
    """
    scopes = [
        "openid",
        "email",
        "profile",
        "https://mail.google.com/"  # Полный доступ к почте
    ]
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(scopes),
        "access_type": "offline",  # Необходимо для получения refresh_token
        "prompt": "consent",  # Запрашивать согласие каждый раз, чтобы точно получить refresh_token
        "include_granted_scopes": "true",
    }
    return {"url": f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"}


@router.get("/google-callback", tags=["oauth"])
async def google_callback(request: Request, response: Response, db: AsyncSession = Depends(deps.get_db), current_user: User = Depends(deps.get_current_user)):
    """
    Обработка callback от Google OAuth2.
    Сохраняет или обновляет аккаунт в oauth_accounts и аутентифицирует пользователя в системе.
    """
    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Код авторизации не найден в callback.")

    # 1. Обмен кода авторизации на токен доступа и refresh_token
    async with httpx.AsyncClient() as client:
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        }
        token_response = await client.post(token_url, data=data)

    if token_response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Не удалось получить токен доступа: {token_response.text}")

    token_data = token_response.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in", 3600)
    id_token = token_data.get("id_token") # Содержит provider_user_id
    scope = token_data.get("scope")

    # 2. Использование токена доступа для получения информации о пользователе
    async with httpx.AsyncClient() as client:
        user_info_url = "https://www.googleapis.com/oauth2/v1/userinfo"
        headers = {"Authorization": f"Bearer {access_token}"}
        user_info_response = await client.get(user_info_url, headers=headers)

    if user_info_response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Не удалось получить информацию о пользователе: {user_info_response.text}")

    user_info = user_info_response.json()
    email = user_info.get("email")
    provider_user_id = user_info.get("id") # ID пользователя в системе Google

    if not email or not provider_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось получить email или ID пользователя от Google.")

    # 3. Обновление email текущего пользователя и сохранение
    current_user.email = email
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    user = current_user

    # 4. Создание или обновление записи в oauth_accounts
    expiry_date = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    account_data = {
        "user_id": user.id,
        "provider": "google",
        "provider_user_id": provider_user_id,
        "email": email,
        "access_token": access_token,
        "token_expiry": expiry_date,
        "scopes": scope.split(" ") if scope else []
    }
    # Refresh token обновляем только если он пришел
    if refresh_token:
        account_data["refresh_token"] = refresh_token

    def _sync_upsert_oauth_account(sdb: SyncSession):
        db_account = crud_oauth_account.get_by_provider_user_id(sdb, provider="google", provider_user_id=provider_user_id)
        if db_account:
            crud_oauth_account.update(sdb, db_obj=db_account, obj_in=account_data)
        else:
            crud_oauth_account.create(sdb, obj_in=account_data)

    await db.run_sync(_sync_upsert_oauth_account)


    return {"message": "Аккаунт Google успешно подключен."}


@router.get("/login/yandex", tags=["oauth"])
def login_yandex():
    """
    Перенаправление на сервер Yandex OAuth 2.0 для инициации аутентификации.
    Запрашивает доступ к информации о пользователе и почте.
    """
    scopes = [
        "login:info",       # Доступ к логину, ФИО, полу, аватарке
        "login:email",      # Доступ к адресу электронной почты
        "mail:imap_full",   # Полный доступ к почте по IMAP (чтение, запись, удаление)
        "mail:smtp",        # Доступ к почте по SMTP для отправки
    ]
    params = {
        "client_id": settings.YANDEX_CLIENT_ID,
        "redirect_uri": settings.YANDEX_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(scopes),
        "force_confirm": "yes", # Принудительно запрашивать согласие, чтобы гарантировать получение токена с нужными правами
    }
    return {"url": f"https://oauth.yandex.ru/authorize?{urlencode(params)}"}


@router.get("/yandex-callback", tags=["oauth"])
async def yandex_callback(request: Request, response: Response, db: AsyncSession = Depends(deps.get_db), current_user: User = Depends(deps.get_current_user)):
    """
    Обработка callback от Yandex OAuth2.
    """
    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Код авторизации не найден в callback.")

    # 1. Обмен кода на токен
    async with httpx.AsyncClient() as client:
        token_url = "https://oauth.yandex.ru/token"
        data = {
            "code": code,
            "grant_type": "authorization_code",
        }
        auth = (settings.YANDEX_CLIENT_ID, settings.YANDEX_CLIENT_SECRET)
        token_response = await client.post(token_url, data=data, auth=auth)

    if token_response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Не удалось получить токен доступа от Яндекса: {token_response.text}")

    token_data = token_response.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in", 3600)
    scope = token_data.get("scope")

    # 2. Получение информации о пользователе
    async with httpx.AsyncClient() as client:
        user_info_url = "https://login.yandex.ru/info"
        headers = {"Authorization": f"OAuth {access_token}"}
        user_info_response = await client.get(user_info_url, headers=headers)

    if user_info_response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Не удалось получить информацию о пользователе от Яндекса: {user_info_response.text}")

    user_info = user_info_response.json()
    email = user_info.get("default_email")
    provider_user_id = user_info.get("id")

    if not email or not provider_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось получить email или ID пользователя от Яндекса.")

    # 3. Обновление email текущего пользователя и сохранение
    current_user.email = email
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    user = current_user

    # 4. Создание или обновление записи в oauth_accounts
    expiry_date = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    account_data = {
        "user_id": user.id,
        "provider": "yandex",
        "provider_user_id": provider_user_id,
        "email": email,
        "access_token": access_token,
        "token_expiry": expiry_date,
        "scopes": scope.split(" ") if scope else []
    }
    if refresh_token:
        account_data["refresh_token"] = refresh_token

    def _sync_upsert_oauth_account(sdb: SyncSession):
        db_account = crud_oauth_account.get_by_provider_user_id(sdb, provider="yandex", provider_user_id=provider_user_id)
        if db_account:
            crud_oauth_account.update(sdb, db_obj=db_account, obj_in=account_data)
        else:
            crud_oauth_account.create(sdb, obj_in=account_data)

    await db.run_sync(_sync_upsert_oauth_account)


    return {"message": "Аккаунт Yandex успешно подключен."}
