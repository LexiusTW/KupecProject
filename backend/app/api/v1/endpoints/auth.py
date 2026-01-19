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
from app.schemas.user import UserCreate, UserBase, Role
from app.schemas.token import TokenPayload, AccessToken # Добавлен AccessToken
from app.crud import user as crud_user
from app.crud import organization as crud_organization
from app.models.user import User

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
    return raw_role.lower() if raw_role else ""


@router.post("/register", response_model=UserBase, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    response: Response,
    db: AsyncSession = Depends(deps.get_db),
):
    existing = {}
    def _sync_get(sdb: SyncSession):
        existing["user_login"] = crud_user.get_by_login(sdb, login=user_in.login)
        existing["user_email"] = crud_user.get_by_email(sdb, email=user_in.email)
        org = crud_organization.get_by_inn(sdb, inn=user_in.organization.inn)
        if org and user_in.role == Role.DIRECTOR:
            director = sdb.query(User).filter(User.organization_id == org.id, User.role == Role.DIRECTOR.value).first()
            if director:
                existing['director_exists'] = True

    await db.run_sync(_sync_get)

    if existing.get("user_login"):
        raise HTTPException(status_code=400, detail="Этот логин уже занят")
    if existing.get("user_email"):
        raise HTTPException(status_code=400, detail="Этот email уже занят")
    if existing.get('director_exists'):
        raise HTTPException(status_code=400, detail="Директор для этой организации уже зарегистрирован")

    created = {}
    def _sync_create(sdb: SyncSession):
        created["user"] = crud_user.create_user(sdb, obj_in=user_in)

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
        result["user"] = crud_user.authenticate(
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
        valid_roles = [r.value.lower() for r in Role]
        if user_id is None or role not in valid_roles:
            raise credentials_exception
    except (ValidationError, Exception):
        raise credentials_exception

    holder = {"user": None}
    def _sync_get(sdb: SyncSession):
        user = crud_user.get_by_id(sdb, user_id=user_id)
        if user and user.role.lower() == role:
            holder["user"] = user

    await db.run_sync(_sync_get)
    user = holder["user"]

    if not user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Пользователь не найден")

    new_access_token = create_access_token(data={"sub": str(user_id), "role": role})

    _set_cookie(response, key="access_token", value=new_access_token, max_age_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {"access_token": new_access_token, "token_type": "bearer"}


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(response: Response):
    _delete_cookie(response, key="access_token")
    _delete_cookie(response, key="refresh_token")
    return {"message": "ok"}


@router.get("/auth/verify")
async def verify_access_token(
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
):
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Нет access токена",
        )

    try:
        payload = jwt.decode(
            access_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        sub = payload.get("sub")
        role = payload.get("role")
        valid_roles = [r.value.lower() for r in Role]
        if not sub or role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверная структура токена",
            )

        user_id = int(sub)
        holder = {"user": None}
        def _sync_get(sdb: SyncSession):
            user = crud_user.get_by_id(sdb, user_id=user_id)
            if user and user.role.lower() == role:
                holder["user"] = user

        await db.run_sync(_sync_get)
        if not holder["user"]:
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