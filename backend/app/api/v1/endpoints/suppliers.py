from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db, get_current_user
from app.models.user import Buyer
from app.models.supplier import Supplier
from app.schemas.supplier import SupplierCreate, SupplierOut, SupplierUpdate

router = APIRouter()

@router.get("/suppliers/my", response_model=List[SupplierOut])
async def list_my_suppliers(
    db: AsyncSession = Depends(get_db),
    user: Buyer = Depends(get_current_user),
):
    """
    Возвращает список поставщиков, добавленных текущим пользователем (покупателем).
    """
    if not isinstance(user, Buyer):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only buyers can have suppliers")

    query = select(Supplier).where(Supplier.buyer_id == user.id).order_by(Supplier.short_name)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/suppliers/my", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    payload: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    user: Buyer = Depends(get_current_user),
):
    """
    Создает нового поставщика для текущего пользователя (покупателя).
    """
    if not isinstance(user, Buyer):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only buyers can create suppliers")

    # Проверка на уникальность ИНН в рамках одного покупателя
    existing_supplier_query = select(Supplier).where(
        Supplier.buyer_id == user.id,
        Supplier.inn == payload.inn
    )
    existing_supplier = (await db.execute(existing_supplier_query)).scalar_one_or_none()
    if existing_supplier:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Поставщик с таким ИНН уже существует у вас")

    db_supplier = Supplier(**payload.model_dump(), buyer_id=user.id)
    db.add(db_supplier)
    await db.commit()
    await db.refresh(db_supplier)
    return db_supplier

@router.put("/suppliers/my/{supplier_id}", response_model=SupplierOut)
async def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    db: AsyncSession = Depends(get_db),
    user: Buyer = Depends(get_current_user),
):
    """
    Обновляет информацию о поставщике.
    """
    if not isinstance(user, Buyer):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only buyers can update suppliers")

    query = select(Supplier).where(Supplier.id == supplier_id, Supplier.buyer_id == user.id)
    result = await db.execute(query)
    db_supplier = result.scalar_one_or_none()

    if not db_supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_supplier, key, value)

    await db.commit()
    await db.refresh(db_supplier)
    return db_supplier

@router.delete("/suppliers/my/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    user: Buyer = Depends(get_current_user),
):
    """
    Удаляет поставщика.
    """
    if not isinstance(user, Buyer):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only buyers can delete suppliers")

    query = select(Supplier).where(Supplier.id == supplier_id, Supplier.buyer_id == user.id)
    result = await db.execute(query)
    db_supplier = result.scalar_one_or_none()

    if not db_supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    await db.delete(db_supplier)
    await db.commit()
    return None