from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.gost import Gost, SteelGrade
from app.schemas.gost import GostOut, SteelGradeOut, SteelGradeWithGosts, GostListItem


router = APIRouter(prefix="/reference/gosts")


@router.get("/", response_model=List[GostListItem])
async def list_gosts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Gost))
    items = result.scalars().all()
    return items


@router.get("/{gost_id}", response_model=GostOut)
async def get_gost(gost_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Gost).where(Gost.id == gost_id))
    gost = result.scalar_one_or_none()
    if gost is None:
        raise HTTPException(status_code=404, detail="ГОСТ не найден")
    return gost


@router.get("/{gost_id}/grades", response_model=List[SteelGradeOut])
async def get_gost_grades(gost_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Gost).where(Gost.id == gost_id))
    gost = result.scalar_one_or_none()
    if gost is None:
        raise HTTPException(status_code=404, detail="ГОСТ не найден")
    return gost.grades


@router.get("/grades", response_model=List[SteelGradeWithGosts])
async def list_grades(q: str | None = Query(default=None), db: AsyncSession = Depends(get_db)):
    stmt = select(SteelGrade)
    if q:
        stmt = stmt.where(SteelGrade.name.ilike(f"%{q}%"))
    result = await db.execute(stmt)
    return result.scalars().all()


