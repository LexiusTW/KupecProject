# app/api/v1/endpoints/counterparties.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.future import select
from app.api import deps
from app.schemas.counterparty import CounterpartyCreate, CounterpartyUpdate, CounterpartyOut
from app.models.counterparty import Counterparty

router = APIRouter()

def ensure_owner(cp: Counterparty, user_id: int):
    if cp.user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

@router.get("", response_model=list[CounterpartyOut])
async def list_my_counterparties(
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    q = select(Counterparty).filter(Counterparty.user_id == current_user.id).order_by(Counterparty.short_name)
    res = await db.execute(q)
    return res.scalars().all()

@router.post("", response_model=CounterpartyOut, status_code=201)
async def create_counterparty(
    payload: CounterpartyCreate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    # необязательная уникальность по ИНН в рамках покупателя
    q = select(Counterparty).filter(
        Counterparty.user_id==current_user.id,
        Counterparty.inn==payload.inn
    )
    exists = (await db.execute(q)).scalars().first()
    if exists:
        raise HTTPException(status_code=409, detail="Контрагент с таким ИНН уже существует")

    cp = Counterparty(user_id=current_user.id, **payload.model_dump())
    db.add(cp)
    await db.commit()
    await db.refresh(cp)
    return cp

@router.get("/by-inn/{inn}", response_model=CounterpartyOut)
async def get_counterparty_by_inn(
    inn: str,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """Ищет контрагента по ИНН в рамках текущего покупателя."""
    q = select(Counterparty).filter(
        Counterparty.user_id == current_user.id, Counterparty.inn == inn
    )
    cp = (await db.execute(q)).scalars().first()
    if not cp: raise HTTPException(status_code=404, detail="Контрагент с таким ИНН не найден")
    return cp

@router.get("/{cp_id}", response_model=CounterpartyOut)
async def get_counterparty(
    cp_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    cp = await db.get(Counterparty, cp_id)
    if not cp: raise HTTPException(status_code=404, detail="Not found")
    ensure_owner(cp, current_user.id)
    return cp

@router.put("/{cp_id}", response_model=CounterpartyOut)
async def update_counterparty(
    cp_id: int,
    payload: CounterpartyUpdate,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    cp = await db.get(Counterparty, cp_id)
    if not cp: raise HTTPException(status_code=404, detail="Not found")
    ensure_owner(cp, current_user.id)

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cp, k, v)
    await db.commit()
    await db.refresh(cp)
    return cp

@router.get("/{cp_id}/has-bank-details", response_model=bool)
async def has_bank_details(
    cp_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    cp = await db.get(Counterparty, cp_id)
    if not cp: raise HTTPException(status_code=404, detail="Not found")
    ensure_owner(cp, current_user.id)
    
    if cp.bank_account and cp.bank_bik and cp.bank_name and cp.bank_corr:
        return True
    return False

@router.delete("/{cp_id}", status_code=204)
async def delete_counterparty(
    cp_id: int,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    cp = await db.get(Counterparty, cp_id)
    if not cp: return
    ensure_owner(cp, current_user.id)
    db.delete(cp)
    await db.commit()
