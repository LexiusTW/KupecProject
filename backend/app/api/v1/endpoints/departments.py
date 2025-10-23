from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.department import Department
from app.schemas.user import Role
from app.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentOut

router = APIRouter()


def _ensure_director(user: User):
    if user.role != Role.DIRECTOR.value:
        raise HTTPException(status_code=403, detail="Недостаточно прав")


@router.post("/departments", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_director(user)

    exists = (await db.execute(select(Department).where(Department.name == payload.name))).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail="Отдел с таким именем уже существует")

    dep = Department(name=payload.name, rop_id=payload.rop_id)
    db.add(dep)
    await db.commit()
    await db.refresh(dep)
    return dep


@router.get("/departments", response_model=list[DepartmentOut])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_director(user)
    rows = (await db.execute(select(Department))).scalars().all()
    return rows


@router.put("/departments/{dep_id}", response_model=DepartmentOut)
async def update_department(
    dep_id: int,
    payload: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_director(user)
    dep = await db.get(Department, dep_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Отдел не найден")
    if payload.name is not None:
        dep.name = payload.name
    if payload.rop_id is not None:
        dep.rop_id = payload.rop_id
    await db.commit()
    await db.refresh(dep)
    return dep


@router.delete("/departments/{dep_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    dep_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _ensure_director(user)
    dep = await db.get(Department, dep_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Отдел не найден")
    await db.delete(dep)
    await db.commit()
    return


