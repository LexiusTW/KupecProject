from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session as SyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import Buyer, Seller
from app.crud.user import update_buyer_address as crud_update_buyer_address

router = APIRouter()

@router.get("/users/me/address")
async def get_my_address(
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    # Только покупатель имеет адрес доставки
    if isinstance(user, Seller):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только для покупателей")

    return {"delivery_address": getattr(user, "delivery_address", None)}

@router.put("/users/me/address")
async def set_my_address(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    if isinstance(user, Seller):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только для покупателей")

    address = (data or {}).get("delivery_address")
    if not address:
        raise HTTPException(status_code=400, detail="delivery_address обязателен")

    holder = {"obj": None}
    def _sync_update(sdb: SyncSession):
        holder["obj"] = crud_update_buyer_address(sdb, user_id=user.id, delivery_address=address)

    await db.run_sync(_sync_update)
    if not holder["obj"]:
        raise HTTPException(status_code=404, detail="Покупатель не найден")

    return {"delivery_address": holder["obj"].delivery_address}
