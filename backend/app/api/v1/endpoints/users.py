from typing import Optional, Union

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import Buyer, Seller

router = APIRouter()

class MeOut(BaseModel):
    id: int
    role: str

class AddressOut(BaseModel):
    delivery_address: Optional[str] = None

class AddressPayload(BaseModel):
    """Разрешаем пустую строку, чтобы сбрасывать адрес (очистка)."""
    delivery_address: Optional[str] = None

async def _set_address(
    payload: AddressPayload,
    db: AsyncSession,
    user: Union[Buyer, Seller],
) -> AddressOut:
    # user берётся из токена в get_current_user — тут НИКАКИХ user_id из запроса
    if isinstance(user, Seller):
        raise HTTPException(status_code=403, detail="Только для покупателей")

    buyer = await db.get(Buyer, user.id)
    if not buyer:
        raise HTTPException(status_code=404, detail="Покупатель не найден")

    raw = (payload.delivery_address or "").strip()

    # пустая строка -> сброс адреса
    if not raw:
        buyer.delivery_address = None
    else:
        if len(raw) < 5:
            raise HTTPException(status_code=422, detail="Адрес слишком короткий (мин. 5 символов)")
        if len(raw) > 500:
            raise HTTPException(status_code=422, detail="Адрес слишком длинный (макс. 500 символов)")
        buyer.delivery_address = raw

    await db.commit()
    return AddressOut(delivery_address=buyer.delivery_address)

@router.get("/users/me/address", response_model=AddressOut, status_code=status.HTTP_200_OK)
async def get_my_address(
    db: AsyncSession = Depends(get_db),
    user: Union[Buyer, Seller] = Depends(get_current_user),
):
    # user из токена → ищем его текущий адрес
    if isinstance(user, Seller):
        raise HTTPException(status_code=403, detail="Только для покупателей")
    return AddressOut(delivery_address=getattr(user, "delivery_address", None))

@router.get("/users/me", response_model=MeOut, status_code=status.HTTP_200_OK)
async def get_me(
    user: Union[Buyer, Seller] = Depends(get_current_user),
):
    role = "seller" if hasattr(user, "inn") else "buyer"
    return MeOut(id=user.id, role=role)

@router.post("/users/me/address", response_model=AddressOut, status_code=status.HTTP_200_OK)
async def set_my_address_post(
    payload: AddressPayload,
    db: AsyncSession = Depends(get_db),
    user: Union[Buyer, Seller] = Depends(get_current_user),
):
    # сохраняем новый адрес пользователю из токена
    return await _set_address(payload, db, user)

# Оставляем совместимость на случай, если где-то остался PUT
@router.put("/users/me/address", response_model=AddressOut, status_code=status.HTTP_200_OK)
async def set_my_address_put(
    payload: AddressPayload,
    db: AsyncSession = Depends(get_db),
    user: Union[Buyer, Seller] = Depends(get_current_user),
):
    return await _set_address(payload, db, user)
