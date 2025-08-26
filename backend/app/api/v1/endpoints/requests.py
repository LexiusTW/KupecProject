from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session as SyncSession, joinedload

from app.api.deps import get_db, get_current_user
from app.models.user import Buyer, Seller
from app.models.request import Request, RequestItem
from app.schemas.request import RequestCreate, RequestOut, RequestItemCreate

router = APIRouter()


@router.get("/requests/me")
async def list_my_requests(
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    if isinstance(user, Seller):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только для покупателей")

    holder = {"rows": []}

    def _sync_list(sdb: SyncSession):
        q = (
            sdb.query(Request)
            .options(joinedload(Request.items))
            .filter(Request.buyer_id == user.id)
            .order_by(Request.id.desc())
        )
        holder["rows"] = [
            {
                "id": r.id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "delivery_address": r.delivery_address,
                "comment": r.comment,
                "items": [
                    {
                        "id": it.id,
                        "kind": it.kind,
                        "category": it.category,
                        "quantity": it.quantity,
                        "comment": it.comment,

                        # metal
                        "stamp": it.stamp,
                        "state_standard": it.state_standard,
                        "city": it.city,
                        "thickness": it.thickness,
                        "length": it.length,
                        "width": it.width,
                        "diameter": it.diameter,
                        "allow_analogs": it.allow_analogs,

                        # generic
                        "name": it.name,
                        "note": it.note,
                    }
                    for it in r.items or []
                ],
            }
            for r in q.all()
        ]

    await db.run_sync(_sync_list)
    return holder["rows"]


@router.post("/requests", response_model=RequestOut, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: RequestCreate,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    if isinstance(user, Seller):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Только для покупателей")

    # Сохраняем заявку и позиции
    holder = {"req_id": None}

    def _infer_kind(it: RequestItemCreate) -> str:
        k = (it.kind or "").strip().lower()
        if k in ("metal", "generic"):
            return k
        # эвристика: если указаны поля metal — считаем metal, иначе generic
        metal_markers = any([it.state_standard, it.stamp, it.thickness, it.length, it.width, it.diameter, it.allow_analogs])
        return "metal" if metal_markers else "generic"

    def _sync_create(sdb: SyncSession):
        req = Request(
            buyer_id=user.id,
            delivery_address=getattr(user, "delivery_address", None),
            comment=payload.comment or None,
        )
        sdb.add(req)
        sdb.flush()

        for it in payload.items:
            kind = _infer_kind(it)

            if kind == "metal":
                row = RequestItem(
                    request_id=req.id,
                    kind="metal",
                    # metal
                    category=it.category,
                    state_standard=it.state_standard,
                    stamp=it.stamp,
                    city=it.city,
                    thickness=it.thickness,
                    length=it.length,
                    width=it.width,
                    diameter=it.diameter,
                    quantity=it.quantity,
                    allow_analogs=bool(it.allow_analogs) if it.allow_analogs is not None else None,
                    comment=it.comment,
                )
            else:
                row = RequestItem(
                    request_id=req.id,
                    kind="generic",
                    # generic
                    category=it.category,   # название пользовательской категории
                    name=it.name,
                    note=it.note,
                    quantity=it.quantity,
                    comment=it.comment,
                )

            sdb.add(row)

        sdb.commit()
        holder["req_id"] = req.id

    await db.run_sync(_sync_create)
    return {"id": holder["req_id"]}
