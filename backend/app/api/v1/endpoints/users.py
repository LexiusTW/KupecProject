from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session as SyncSession

from app.api.deps import get_db, get_current_user
from app.core import security
from app.models.user import User
from app.schemas.user import UserChangePassword, UserCreateByAdmin, UserBase, Role, UserUpdateByAdmin
from app.crud import user as crud_user

router = APIRouter()

# Dependency to check for Director or ROP role
def get_current_active_director_or_rop(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Неактивный пользователь")
    if current_user.role not in [Role.DIRECTOR.value, Role.HEAD_OF_SALES.value]:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    return current_user


@router.get("/users", response_model=List[UserBase])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_director_or_rop),
):
    """Получить список всех пользователей. Доступно Директору и РОПам."""
    users_result = {}
    if current_user.role == Role.DIRECTOR.value:
        # Директор видит всех пользователей своей организации
        def _sync_get_by_org(sdb: SyncSession):
            users_result['users'] = crud_user.get_by_organization(sdb, organization_id=current_user.organization_id)
        await db.run_sync(_sync_get_by_org)
    elif current_user.role == Role.HEAD_OF_SALES.value:
        # РОП видит только своих подчиненных менеджеров
        def _sync_get_by_parent(sdb: SyncSession):
            users_result['users'] = crud_user.get_by_parent(sdb, parent_id=current_user.id)
        await db.run_sync(_sync_get_by_parent)

    return users_result.get('users', [])


@router.post("/users", response_model=UserBase, status_code=status.HTTP_201_CREATED)
async def create_user(
    *, 
    db: AsyncSession = Depends(get_db),
    user_in: UserCreateByAdmin,
    current_user: User = Depends(get_current_active_director_or_rop),
):
    """Создание нового пользователя Директором или РОПом."""
    
    existing = {}
    def _sync_check(sdb: SyncSession):
        existing['login'] = crud_user.get_by_login(sdb, login=user_in.login)
        existing['email'] = crud_user.get_by_email(sdb, email=user_in.email)
    await db.run_sync(_sync_check)

    if existing.get('login'):
        raise HTTPException(status_code=400, detail="Этот логин уже занят")
    if existing.get('email'):
        raise HTTPException(status_code=400, detail="Этот email уже занят")

    if current_user.role == Role.HEAD_OF_SALES.value:
        if user_in.role != Role.MANAGER:
            raise HTTPException(status_code=403, detail="РОП может создавать только Менеджеров")
        user_in.parent_id = current_user.id

    elif current_user.role == Role.DIRECTOR.value:
        if user_in.role == Role.MANAGER and user_in.parent_id:
            parent_user_res = {}
            def _sync_get_parent(sdb: SyncSession):
                parent_user_res['user'] = crud_user.get_by_id(sdb, user_id=user_in.parent_id)
            await db.run_sync(_sync_get_parent)
            parent_user = parent_user_res.get('user')
            
            if not parent_user or parent_user.role != Role.HEAD_OF_SALES.value:
                raise HTTPException(status_code=400, detail="Указанный руководитель не является РОПом")
            if parent_user.organization_id != current_user.organization_id:
                raise HTTPException(status_code=403, detail="Нельзя назначить руководителя из другой организации")

    created_user_res = {}
    def _sync_create(sdb: SyncSession):
        created_user_res['user'] = crud_user.create_user_by_admin(sdb, obj_in=user_in, creator=current_user)
    await db.run_sync(_sync_create)
    
    return created_user_res['user']


@router.put("/users/{user_id}", response_model=UserBase)
async def update_user(
    user_id: int,
    user_in: UserUpdateByAdmin,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_director_or_rop),
):
    """Обновление пользователя Директором или РОПом."""
    user_res = {}
    def _sync_get_user(sdb: SyncSession):
        user_res['user'] = crud_user.get_by_id(sdb, user_id=user_id)
    await db.run_sync(_sync_get_user)
    user_to_update = user_res.get('user')

    if not user_to_update:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if user_to_update.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Нельзя изменять пользователя из другой организации")

    if current_user.role == Role.HEAD_OF_SALES.value:
        # РОП может редактировать только менеджеров в своей группе или себя
        is_own_profile = user_to_update.id == current_user.id
        is_his_manager = user_to_update.role == Role.MANAGER.value and user_to_update.parent_id == current_user.id

        if not (is_own_profile or is_his_manager):
            raise HTTPException(status_code=403, detail="РОП может изменять только себя или своих Менеджеров")
        
        # РОП не может менять роль
        if user_in.role is not None and user_in.role.value != user_to_update.role:
            raise HTTPException(status_code=403, detail="РОП не может изменять роль пользователя")

    updated_user_res = {}
    def _sync_update(sdb: SyncSession):
        updated_user_res['user'] = crud_user.update(sdb, db_obj=user_to_update, obj_in=user_in)
    await db.run_sync(_sync_update)

    return updated_user_res['user']


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_director_or_rop),
):
    """Удаление пользователя Директором или РОПом."""
    user_res = {}
    def _sync_get_user(sdb: SyncSession):
        user_res['user'] = crud_user.get_by_id(sdb, user_id=user_id)
    await db.run_sync(_sync_get_user)
    user_to_delete = user_res.get('user')

    if not user_to_delete:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if user_to_delete.id == current_user.id:
        raise HTTPException(status_code=403, detail="Нельзя удалить самого себя")

    if user_to_delete.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Нельзя удалять пользователя из другой организации")

    if current_user.role == Role.HEAD_OF_SALES.value:
        if user_to_delete.role != Role.MANAGER.value or user_to_delete.parent_id != current_user.id:
            raise HTTPException(status_code=403, detail="РОП может удалять только своих Менеджеров")

    def _sync_delete(sdb: SyncSession):
        crud_user.remove(sdb, db_obj=user_to_delete)
    await db.run_sync(_sync_delete)


@router.get("/users/me", response_model=UserBase, status_code=status.HTTP_200_OK)
async def get_me(
    user: User = Depends(get_current_user),
):
    """Получить данные текущего пользователя."""
    return user

class ProfilePayload(BaseModel):
    delivery_address: Optional[str] = None
    email_footer: Optional[str] = None
    logo_url: Optional[str] = None

class AddressOut(BaseModel):
    delivery_address: Optional[str] = None

class AddressPayload(BaseModel):
    """Разрешаем пустую строку, чтобы сбрасывать адрес (очистка)."""
    delivery_address: Optional[str] = None

class FooterOut(BaseModel):
    email_footer: Optional[str] = None


class FooterPayload(BaseModel):
    """Разрешаем пустую строку, чтобы сбрасывать футер (очистка)."""
    email_footer: Optional[str] = None


async def _set_address(
    payload: AddressPayload,
    db: AsyncSession,
    user: User,
) -> AddressOut:
    # user берётся из токена в get_current_user — тут НИКАКИХ user_id из запроса
    user = await db.get(User, user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    raw = (payload.delivery_address or "").strip()

    # пустая строка -> сброс адреса
    if not raw:
        user.delivery_address = None
    else:
        if len(raw) < 5:
            raise HTTPException(status_code=422, detail="Адрес слишком короткий (мин. 5 символов)")
        if len(raw) > 500:
            raise HTTPException(status_code=422, detail="Адрес слишком длинный (макс. 500 символов)")
        user.delivery_address = raw

    await db.commit()
    return AddressOut(delivery_address=user.delivery_address)


async def _set_footer(
    payload: FooterPayload,
    db: AsyncSession,
    user: User,
) -> FooterOut:
    user = await db.get(User, user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    raw = (payload.email_footer or "").strip()

    if not raw:
        user.email_footer = "С уважением, Пользователь!"
    else:
        if len(raw) > 500:
            raise HTTPException(status_code=422, detail="Футер слишком длинный (макс. 500 символов)")
        user.email_footer = raw

    await db.commit()
    return FooterOut(email_footer=user.email_footer)

@router.get("/users/me/address", response_model=AddressOut, status_code=status.HTTP_200_OK)
async def get_my_address(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # user из токена → ищем его текущий адрес
    return AddressOut(delivery_address=getattr(user, "delivery_address", None))


@router.get("/users/me/footer", response_model=FooterOut, status_code=status.HTTP_200_OK)
async def get_my_footer(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return FooterOut(email_footer=getattr(user, "email_footer", "С уважением, Пользователь!"))


@router.post("/users/me/footer", response_model=FooterOut, status_code=status.HTTP_200_OK)
async def set_my_footer_post(
    payload: FooterPayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _set_footer(payload, db, user)


@router.put("/users/me/footer", response_model=FooterOut, status_code=status.HTTP_200_OK)
async def set_my_footer_put(
    payload: FooterPayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _set_footer(payload, db, user)



@router.post("/users/me/address", response_model=AddressOut, status_code=status.HTTP_200_OK)
async def set_my_address_post(
    payload: AddressPayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # сохраняем новый адрес пользователю из токена
    return await _set_address(payload, db, user)


@router.post("/users/me/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    password_data: UserChangePassword,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not security.verify_password(password_data.old_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Неверный старый пароль")

    user.hashed_password = security.get_password_hash(password_data.new_password)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return {"message": "Пароль успешно изменен"}

class MeOut(BaseModel):
    id: int
    login: str
    role: str

@router.post("/users/me/profile", response_model=MeOut, status_code=status.HTTP_200_OK)
async def update_profile(
    payload: ProfilePayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    user = await db.get(User, user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if payload.delivery_address is not None:
        raw = (payload.delivery_address or "").strip()
        user.delivery_address = raw if raw else None
    if payload.email_footer is not None:
        raw = (payload.email_footer or "").strip()
        user.email_footer = raw if raw else "С уважением, Пользователь!"
    if payload.logo_url is not None:
        user.logo_url = payload.logo_url.strip() if payload.logo_url else None

    await db.commit()
    return MeOut(id=user.id, login=user.login, role=user.role)
