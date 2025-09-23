from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db, get_current_user
from app.models.user import Buyer
from app.models.supplier import Supplier
from app.schemas.supplier import SupplierCreate, SupplierOut, SupplierUpdate

router = APIRouter()


from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, cast, String

from app.api.deps import get_db, get_current_user
from app.models.user import Buyer
from app.models.supplier import Supplier
from app.schemas.supplier import SupplierCreate, SupplierOut, SupplierUpdate

router = APIRouter()


@router.get("/suppliers/by-category", response_model=List[SupplierOut])
async def list_suppliers_by_category(
    category: str,
    db: AsyncSession = Depends(get_db),
    user: Buyer = Depends(get_current_user),
):
    """
    Возвращает список поставщиков текущего покупателя, у которых в списке категорий есть совпадение.
    """
    if not isinstance(user, Buyer):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только покупатели могут запрашивать поставщиков")

    q = select(Supplier).where(Supplier.buyer_id == user.id)
    
    if category:
        # Поиск внутри JSON массива. Приводим к строке для регистронезависимого поиска.
        # Это не самый производительный способ, но он универсален для разных БД.
        # Ищем точное совпадение элемента в кавычках, чтобы избежать частичных совпадений.
        q = q.where(cast(Supplier.category, String).ilike(f'%"{category}"%'))

    result = await db.execute(q.order_by(Supplier.short_name))
    return result.scalars().all()

@router.get("/suppliers/my", response_model=List[SupplierOut])
async def list_my_suppliers(
    db: AsyncSession = Depends(get_db),
    user: Buyer = Depends(get_current_user),
):
    """
    Возвращает список поставщиков, добавленных текущим пользователем (покупателем).
    """
    if not isinstance(user, Buyer):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только покупатели могут иметь поставщиков")

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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только покупатели могут создавать поставщиков")

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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только покупатели могут обновлять поставщиков")

    query = select(Supplier).where(Supplier.id == supplier_id, Supplier.buyer_id == user.id)
    result = await db.execute(query)
    db_supplier = result.scalar_one_or_none()

    if not db_supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Поставщик не найден")

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нет данных для обновления")

    # Если обновляется ИНН, проверим уникальность в рамках этого покупателя
    if "inn" in update_data:
        existing_inn_q = select(Supplier).where(
            Supplier.buyer_id == user.id,
            Supplier.inn == update_data["inn"],
            Supplier.id != supplier_id
        )
        existing_with_inn = (await db.execute(existing_inn_q)).scalar_one_or_none()
        if existing_with_inn:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="У вас уже есть поставщик с таким ИНН")
    for key, value in update_data.items():
        setattr(db_supplier, key, value)

    await db.commit()
    await db.refresh(db_supplier)
    return db_supplier


@router.patch("/suppliers/my/{supplier_id}", response_model=SupplierOut)
async def patch_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    db: AsyncSession = Depends(get_db),
    user: Buyer = Depends(get_current_user),
):
    """
    Частичное обновление поставщика. Поведение аналогично PUT, но позволяет отправлять только изменённые поля.
    """
    return await update_supplier(supplier_id=supplier_id, payload=payload, db=db, user=user)

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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только покупатели могут удалять поставщиков")

    query = select(Supplier).where(Supplier.id == supplier_id, Supplier.buyer_id == user.id)
    result = await db.execute(query)
    db_supplier = result.scalar_one_or_none()

    if not db_supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Поставщик не найден")

    await db.delete(db_supplier)
    await db.commit()
    return None