from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from jose import jwt
from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session as SyncSession
from datetime import datetime, timezone
from app.api import deps
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token
from app.schemas.user import BuyerUserCreate, SellerUserCreate, UserSchema
from app.schemas.token import TokenPayload, AccessToken
from app.crud.user import (
    get_by_login as crud_get_by_login,
    create_buyer as crud_create_buyer,
    create_seller as crud_create_seller,
    authenticate as crud_authenticate,
    get_by_id_with_role as crud_get_by_id_with_role,
)

router = APIRouter()


def _set_cookie(response: Response, *, key: str, value: str, max_age_minutes: int):
    response.set_cookie(
        key=key,
        value=value,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path=settings.COOKIE_PATH,
        max_age=max_age_minutes * 60,
    )


def _delete_cookie(response: Response, *, key: str):
    response.delete_cookie(
        key=key,
        domain=settings.COOKIE_DOMAIN,
        path=settings.COOKIE_PATH,
    )


def _role_for_token(raw_role: Optional[str], user_obj) -> str:
    if raw_role == "Покупатель":
        return "buyer"
    if raw_role == "Продавец":
        return "seller"
    return "seller" if hasattr(user_obj, "inn") else "buyer"

@router.post("/register/buyer", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def register_buyer(
    user_in: BuyerUserCreate,
    response: Response,
    db: AsyncSession = Depends(deps.get_db),
):
    """Регистрация покупателя + мгновенная установка access/refresh токенов в куки."""
    existing = {"user": None}

    def _sync_get(sdb: SyncSession):
        existing["user"] = crud_get_by_login(sdb, login=user_in.login)

    await db.run_sync(_sync_get)
    if existing["user"]:
        raise HTTPException(status_code=400, detail="Логин уже занят")

    created = {"user": None}

    def _sync_create(sdb: SyncSession):
        created["user"] = crud_create_buyer(
            sdb,
            login=user_in.login,
            password=user_in.password,
        )

    await db.run_sync(_sync_create)
    user = created["user"]

    role_for_token = _role_for_token(getattr(user, "role", None), user)
    subject = str(user.id)
    access_token = create_access_token(data={"sub": subject, "role": role_for_token})
    refresh_token = create_refresh_token(data={"sub": subject, "role": role_for_token})

    _set_cookie(response, key="access_token", value=access_token, max_age_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    _set_cookie(response, key="refresh_token", value=refresh_token, max_age_minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)

    return user


@router.post("/register/seller", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def register_seller(
    user_in: SellerUserCreate,
    response: Response,
    db: AsyncSession = Depends(deps.get_db),
):
    """Регистрация продавца + мгновенная установка access/refresh токенов в куки."""
    def _sync_checks(sdb: SyncSession):
        if crud_get_by_login(sdb, login=user_in.login):
            raise HTTPException(status_code=400, detail="Логин уже занят")

    await db.run_sync(_sync_checks)

    created = {"user": None}

    def _sync_create(sdb: SyncSession):
        created["user"] = crud_create_seller(
            sdb,
            login=user_in.login,
            password=user_in.password,
            inn=user_in.inn or "",
            director_name=user_in.director_name or "",
            phone_number=user_in.phone_number or "",
            legal_address=user_in.legal_address or "",
        )

    await db.run_sync(_sync_create)
    user = created["user"]

    role_for_token = _role_for_token(getattr(user, "role", None), user)
    subject = str(user.id)
    access_token = create_access_token(data={"sub": subject, "role": role_for_token})
    refresh_token = create_refresh_token(data={"sub": subject, "role": role_for_token})

    _set_cookie(response, key="access_token", value=access_token, max_age_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    _set_cookie(response, key="refresh_token", value=refresh_token, max_age_minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)

    return user


class LoginRequest(BaseModel):
    login: str
    password: str

@router.post("/login")
async def login(
    creds: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(deps.get_db),
):

    result = {"user": None}

    def _sync_auth(sdb: SyncSession):
        result["user"] = crud_authenticate(
            sdb,
            login=creds.login,
            password=creds.password,
        )

    await db.run_sync(_sync_auth)
    user = result["user"]

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль")

    role_for_token = _role_for_token(getattr(user, "role", None), user)
    subject = str(user.id)
    access_token = create_access_token(data={"sub": subject, "role": role_for_token})
    refresh_token = create_refresh_token(data={"sub": subject, "role": role_for_token})

    _set_cookie(response, key="access_token", value=access_token, max_age_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    _set_cookie(response, key="refresh_token", value=refresh_token, max_age_minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)

    return {"message": "ok"}


@router.post("/refresh", response_model=AccessToken)
async def refresh_access_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(deps.get_db),
):
    """Обновление access-токена. Refresh читаем из HttpOnly cookie."""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет refresh токена")

    credentials_exception = HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Невалидный refresh токен",
    )
    try:
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_data = TokenPayload(**payload)
        role = payload.get("role")
        user_id = int(token_data.sub) if token_data.sub is not None else None
        if user_id is None or role not in ("buyer", "seller"):
            raise credentials_exception
    except (ValidationError, Exception):
        raise credentials_exception

    existence = {"user": None}

    def _sync_get(sdb: SyncSession):
        existence["user"] = crud_get_by_id_with_role(sdb, role=role, user_id=user_id)

    await db.run_sync(_sync_get)
    if not existence["user"]:
        raise credentials_exception

    new_access_token = create_access_token(data={"sub": str(user_id), "role": role})

    _set_cookie(response, key="access_token", value=new_access_token, max_age_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {"access_token": new_access_token, "token_type": "bearer"}


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(response: Response):
    """Чистим обе куки."""
    _delete_cookie(response, key="access_token")
    _delete_cookie(response, key="refresh_token")
    return {"message": "ok"}


@router.get("/auth/verify")
async def verify_access_token(
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
):
    """Проверка валидности access-токена из HttpOnly cookie"""
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Нет access токена",
        )

    try:
        # Декодируем токен
        payload = jwt.decode(
            access_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        # Проверка структуры
        sub = payload.get("sub")
        role = payload.get("role")
        if not sub or role not in ("buyer", "seller"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверная структура токена",
            )

        # Проверим пользователя в базе
        user_id = int(sub)
        existence = {"user": None}

        def _sync_get(sdb: SyncSession):
            existence["user"] = crud_get_by_id_with_role(
                sdb, role=role, user_id=user_id
            )

        await db.run_sync(_sync_get)
        if not existence["user"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь не найден",
            )

        return {"valid": True, "user_id": user_id, "role": role}

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access токен истёк",
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный access токен",
        )
