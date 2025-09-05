from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.api.deps import get_db, get_current_user
from app.models.user import Buyer, Seller
from app.models.request import Request, RequestItem
from app.schemas.request import RequestCreate, RequestOut, RequestItemCreate

router = APIRouter()

def _infer_kind(it: RequestItemCreate) -> str:
    """Если kind не задан, определяем:
    - metal: есть хоть один из (stamp/state_standard/size/thickness/length/width/diameter)
    - иначе generic
    """
    if it.kind in ("metal", "generic"):
        return it.kind
    metal_signals = any([
        bool(it.stamp), bool(it.state_standard), bool(it.size),
        (it.thickness is not None), (it.length is not None),
        (it.width is not None), (it.diameter is not None)
    ])
    return "metal" if metal_signals else "generic"

@router.get("/requests/me")
async def list_my_requests(
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    if isinstance(user, Seller):
        return []

    q = (
        select(Request)
        .where(Request.buyer_id == user.id)
        .options(joinedload(Request.items))
        .order_by(Request.created_at.desc())
    )
    rows = (await db.execute(q)).scalars().all()

    result: List[Dict[str, Any]] = []
    for r in rows:
        result.append({
            "id": r.id,
            "delivery_address": r.delivery_address,
            "comment": r.comment,
            "created_at": r.created_at,
            "items": [
                {
                    "id": it.id,
                    "kind": it.kind,
                    "category": it.category,
                    "size": it.size,
                    "dims": it.dims,
                    "uom": it.uom,
                    "stamp": it.stamp,
                    "state_standard": it.state_standard,
                    "thickness": it.thickness,
                    "length": it.length,
                    "width": it.width,
                    "diameter": it.diameter,
                    "allow_analogs": it.allow_analogs,
                    "name": it.name,
                    "note": it.note,
                    "quantity": it.quantity,
                    "comment": it.comment,
                }
                for it in (r.items or [])
            ],
        })
    return result

@router.post("/requests", response_model=RequestOut, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: RequestCreate,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    # адрес: берём из payload (если прислали), иначе — из профиля покупателя
    delivery_address = payload.delivery_address or getattr(user, "delivery_address", None)

    req = Request(
        buyer_id=user.id,  # id берётся из токена через get_current_user
        delivery_address=delivery_address,
        comment=payload.comment,
    )
    db.add(req)
    await db.flush()  # получим req.id

    for it in payload.items:
        kind = _infer_kind(it)

        if kind == "metal":
            row = RequestItem(
                request_id=req.id,
                kind="metal",
                category=it.category,
                quantity=it.quantity,
                comment=it.comment,
                size=it.size,
                stamp=it.stamp,
                state_standard=it.state_standard,
                thickness=it.thickness,
                length=it.length,
                width=it.width,
                diameter=it.diameter,
                allow_analogs=it.allow_analogs,
            )
        else:
            if not it.name:
                raise HTTPException(status_code=422, detail="Для generic-позиции требуется 'name'")
            row = RequestItem(
                request_id=req.id,
                kind="generic",
                category=it.category or "Прочее",
                quantity=it.quantity,
                comment=it.comment,
                dims=it.dims,
                uom=it.uom,
                name=it.name,
                note=it.note,
            )

        db.add(row)

    await db.commit()
    return {"id": req.id}
