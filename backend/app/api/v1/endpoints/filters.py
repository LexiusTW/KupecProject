from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Column, Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.metal import Metal
from app.models.warehouse import Warehouse

router = APIRouter()


def _get_base_query_with_filters(
    supplier: Optional[str] = None,
    category: Optional[str] = None,
    stamp: Optional[str] = None,
    gost: Optional[str] = None,
    city: Optional[str] = None,
) -> Select:
    """Строит базовый запрос SQLAlchemy с учетом переданных фильтров."""
    query = select(Metal.id).join(Warehouse, Metal.warehouse_id == Warehouse.id)
    if supplier:
        query = query.where(Warehouse.supplier == supplier)
    if category:
        query = query.where(Metal.category == category)
    if stamp:
        query = query.where(Metal.stamp == stamp)
    if gost:
        query = query.where(Metal.state_standard == gost)
    if city:
        query = query.where(Warehouse.city == city)
    return query

async def _get_distinct_values(
    db: AsyncSession, column: Column, base_query: Select
) -> List[str]:
    """
    Получает уникальные значения для указанной колонки,
    ограничиваясь результатами из базового запроса.
    """
    # Создаем основной запрос для получения уникальных значений из нужной колонки
    main_query = select(column).where(Metal.id.in_(base_query.subquery()))

    # Если колонка из Warehouse, нам нужно добавить JOIN, чтобы SQLAlchemy знала, как связать таблицы
    if column.table.name == "warehouse":
        main_query = main_query.join_from(Metal, Warehouse)

    # Получаем уникальные, не-null значения и сортируем их
    final_query = main_query.distinct().order_by(column.asc())

    result = await db.execute(final_query)
    values = [row[0] for row in result.all() if row[0]]
    return values


@router.get("/suppliers", response_model=List[str], tags=["filters"])
async def get_suppliers(
    db: AsyncSession = Depends(get_db),
    category: Optional[str] = None,
    stamp: Optional[str] = None,
    gost: Optional[str] = None,
    city: Optional[str] = None,
):
    """
    Получает список уникальных поставщиков, с возможностью фильтрации
    по другим параметрам для динамической подгрузки в форму поиска.
    """

    query = select(Warehouse.supplier).join(
        Metal, Warehouse.id == Metal.warehouse_id
    )

    # Применяем фильтры, если они были переданы
    if category:
        query = query.where(Metal.category == category)
    if stamp:
        query = query.where(Metal.stamp == stamp)
    if gost:
        query = query.where(Metal.state_standard == gost)
    if city:
        query = query.where(Warehouse.city == city)

    # Получаем уникальные значения и сортируем их
    query = query.distinct().order_by(Warehouse.supplier)

    result = await db.execute(query)
    suppliers = [row[0] for row in result.all() if row[0]]
    return suppliers



@router.get("/categories", response_model=List[str], tags=["filters"])
async def get_categories(
    db: AsyncSession = Depends(get_db),
    supplier: Optional[str] = Query(None),
    stamp: Optional[str] = Query(None),
    gost: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
):
    """Получение списка уникальных категорий с учетом фильтров."""
    base_query = _get_base_query_with_filters(supplier=supplier, stamp=stamp, gost=gost, city=city)
    return await _get_distinct_values(db, Metal.category, base_query)


@router.get("/stamps", response_model=List[str], tags=["filters"])
async def get_stamps(
    db: AsyncSession = Depends(get_db),
    supplier: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    gost: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
):
    """Получение списка уникальных марок стали с учетом фильтров."""
    base_query = _get_base_query_with_filters(supplier=supplier, category=category, gost=gost, city=city)
    return await _get_distinct_values(db, Metal.stamp, base_query)


@router.get("/gosts", response_model=List[str], tags=["filters"])
async def get_gosts(
    db: AsyncSession = Depends(get_db),
    supplier: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    stamp: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
):
    """Получение списка уникальных ГОСТов с учетом фильтров."""
    base_query = _get_base_query_with_filters(supplier=supplier, category=category, stamp=stamp, city=city)
    return await _get_distinct_values(db, Metal.state_standard, base_query)


@router.get("/cities", response_model=List[str], tags=["filters"])
async def get_cities(
    db: AsyncSession = Depends(get_db),
    category: Optional[str] = None,
    stamp: Optional[str] = None,
    gost: Optional[str] = None,
    supplier: Optional[str] = None,
):
    """
    Получает список уникальных городов, с возможностью фильтрации.
    """
    # Выбираем колонку 'city' из таблицы Warehouse и соединяем с Metal
    query = select(Warehouse.city).join(
        Metal, Warehouse.id == Metal.warehouse_id
    )

    # Применяем фильтры, если они переданы
    if category:
        query = query.where(Metal.category == category)
    if stamp:
        query = query.where(Metal.stamp == stamp)
    if gost:
        query = query.where(Metal.state_standard == gost)
    if supplier:
        query = query.where(Warehouse.supplier == supplier)

    # Получаем уникальные непустые значения и сортируем их
    query = query.distinct().order_by(Warehouse.city)

    result = await db.execute(query)
    cities = [row[0] for row in result.all() if row[0]]
    return cities


@router.get("/last-update-time", response_model=dict, tags=["filters"])
async def get_last_update_time(db: AsyncSession = Depends(get_db)):
    """Возвращает время последнего обновления данных от парсеров."""
    if not hasattr(Metal, "price_updated_at"):
        return {"last_update": None, "error": "В модели Metal отсутствует поле updated_at"}

    query = select(func.max(Metal.price_updated_at))
    last_update = (await db.execute(query)).scalar_one_or_none()
    return {"last_update": last_update}

