from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.api.deps import get_db, get_current_user
from app.models.user import Buyer, Seller
from app.models.request import Request, RequestItem
from app.models.crm import Email
from app.excel_processor import ExcelProcessor
from app.schemas.request import RequestCreate, RequestOut, RequestItemCreate, RequestItemOut

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

@router.get("/requests/me", response_model=List[RequestOut])
async def list_my_requests(
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    if isinstance(user, Seller):
        return []
    
    q = (
        select(Request)
        .where(Request.buyer_id == user.id)
        .options(selectinload(Request.items), joinedload(Request.counterparty))
        .order_by(Request.created_at.desc())
    )
    rows = (await db.execute(q)).scalars().all()
    return rows

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
        delivery_at=payload.delivery_at,
        counterparty_id=payload.counterparty_id,
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
    await db.refresh(req, attribute_names=["items", "counterparty"])
    return req

@router.post("/requests/{request_id}/send", status_code=status.HTTP_202_ACCEPTED)
async def send_request_to_suppliers(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: Buyer = Depends(get_current_user),
):
    """
    "Рассылает" заявку. На данном этапе это означает создание Email-сообщения
    в "Отправленных" у пользователя.
    """
    if not isinstance(user, Buyer):
        raise HTTPException(status_code=403, detail="Only buyers can send requests")

    # 1. Находим заявку и проверяем, что она принадлежит пользователю
    q = select(Request).where(Request.id == request_id, Request.buyer_id == user.id).options(selectinload(Request.items))
    req = (await db.execute(q)).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found or access denied")

    # 2. Формируем тему и тело письма
    subject = f"Заявка №{req.id}: {req.comment or 'Без названия'}"
    
    items_html = "<ul>"
    for item in req.items:
        if item.kind == 'metal':
            details = f"{item.category or ''} {item.size or ''} {item.stamp or ''} {item.state_standard or ''}".strip()
            items_html += f"<li>{details} - {item.quantity} шт.</li>"
        else:
            items_html += f"<li>{item.name or 'Прочее'} - {item.quantity} {item.uom or 'шт.'}</li>"
    items_html += "</ul>"
    
    content = f"""<h3>Детали заявки:</h3>{items_html}"""

    # 3. Генерируем Excel файл
    excel_processor = ExcelProcessor()
    try:
        # generate_request_excel возвращает словарь {kind: filepath}
        # Мы предполагаем, что для заявки может быть несколько файлов (metal, generic)
        # Для простоты пока берем первый попавшийся путь.
        # В будущем можно будет хранить JSON со всеми путями.
        files_created = await excel_processor.generate_request_excel(req.id, db)
        # Берем путь к первому сгенерированному файлу
        excel_path = next(iter(files_created.values())) if files_created else None
    except Exception as e:
        # Если генерация Excel не удалась, мы не прерываем процесс, а просто логируем ошибку
        print(f"Could not generate Excel file for request {req.id}: {e}")
        excel_path = None

    # 4. Создаем запись в таблице Email
    # Так как это "рассылка" самому себе в "Отправленные",
    # указываем и отправителя, и получателя как текущего пользователя.
    email = Email(
        sender_buyer_id=user.id,
        receiver_buyer_id=user.id,  # Указываем получателя, чтобы пройти CHECK constraint
        subject=subject,
        content=content,
        excel_file_path=excel_path
    )
    db.add(email)
    await db.commit()
    await db.refresh(email)

    return {"message": "Request has been sent and saved to your outbox.", "email_id": email.id}
