from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.metal import Metal
from app.models.warehouse import Warehouse
from app.schemas.search import SearchResult

router = APIRouter()


@router.get("/search", response_model=SearchResult, summary="Search for metal products")
async def search_metal(
    db: AsyncSession = Depends(get_db),
    # Параметры фильтрации
    supplier: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    stamp: Optional[str] = Query(None),
    state_standard: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    thickness: Optional[float] = Query(None),
    length: Optional[float] = Query(None),
    width: Optional[float] = Query(None),
    diameter: Optional[float] = Query(None),
    # Параметры пагинации
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    Поиск металлопродукции по различным фильтрам с пагинацией.
    """
    # Базовый запрос, который объединяет Metal и Warehouse
    query = (
        select(
            Metal.id,
            Metal.name,
            Metal.category,
            Metal.stamp,
            Metal.state_standard.label("gost"),
            Warehouse.city,
            Metal.thickness,
            Metal.length,
            Metal.width,
            Metal.diameter,
            Metal.price,
            Warehouse.supplier,
            Metal.material,
        )
        .join(Warehouse, Metal.warehouse_id == Warehouse.id)
    )

    # Применяем фильтры к соответствующим таблицам
    if supplier:
        query = query.where(Warehouse.supplier == supplier)
    if city:
        query = query.where(Warehouse.city == city)
    if category:
        query = query.where(Metal.category == category)
    if stamp:
        query = query.where(Metal.stamp == stamp)
    if state_standard:
        query = query.where(Metal.state_standard == state_standard)
    if thickness:
        query = query.where(Metal.thickness == thickness)
    if length:
        query = query.where(Metal.length == length)
    if width:
        query = query.where(Metal.width == width)
    if diameter:
        query = query.where(Metal.diameter == diameter)

    count_query = select(func.count()).select_from(query.order_by(None).subquery())
    total = (await db.execute(count_query)).scalar_one_or_none() or 0
    
    query = query.order_by(Metal.id).limit(limit).offset(offset)

    result = await db.execute(query)
    items = result.mappings().all()

    return {"items": items, "total": total}

