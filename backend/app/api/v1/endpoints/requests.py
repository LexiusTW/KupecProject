from typing import Any, Dict, List, Union, Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.models.user import Buyer, Seller
from app.models.request import Request, RequestItem, Offer, OfferItem
from app.models.crm import Email
from app.models.supplier import Supplier
from app.models.offer_token import OfferToken
from app.excel_processor import ExcelProcessor
from app.schemas.request import RequestCreate, RequestOut, RequestItemCreate, RequestItemOut, OfferCreate
from app.services.email_service import send_email_background

router = APIRouter()

class SavedItemBase(BaseModel):
    id: str
    quantity: float | None = None
    comment: str | None = None

class SavedMetalItem(SavedItemBase):
    kind: Literal['metal']
    category: str | None = None
    size: str | None = None
    state_standard: str | None = None
    stamp: str | None = None
    allow_analogs: bool
    unit: str | None = None

class SavedGenericItem(SavedItemBase):
    kind: Literal['generic']
    category: str
    name: str
    dims: str | None = None
    unit: str | None = None

class GroupPayload(BaseModel):
    group_key: str
    category_titles: List[str]
    supplier_ids: List[int]
    manual_emails: List[EmailStr]
    items: List[Annotated[Union[SavedMetalItem, SavedGenericItem], Field(discriminator='kind')]]
    email_header: str | None = None
    email_footer: str | None = None


class SendToSuppliersPayload(BaseModel):
    groups: List[GroupPayload]

def _generate_email_html(
    items: List[Union[SavedMetalItem, SavedGenericItem]],
    req: Request,
    user: Buyer,
    header_text: str | None = None,
    footer_text: str | None = None,
    token: UUID | None = None,
) -> str:
    request_url = f"{settings.FRONTEND_URL}/request/{req.id}"
    if token:
        request_url += f"?token={token}"

    # 1. Определяем тип таблицы и заголовки
    is_metal_only = all(item.kind == 'metal' for item in items)
    is_generic_only = all(item.kind == 'generic' for item in items)

    if is_metal_only:
        headers = ["Категория", "Наименование", "Размер", "ГОСТ", "Марка", "Аналоги", "Количество", "Ед. изм.", "Комментарий"]
    elif is_generic_only:
        headers = ["Наименование", "Размеры, характеристики", "Ед. изм.", "Количество", "Комментарий"]
    else: # Смешанный тип
        headers = ["Категория", "Наименование", "Размер/Характеристики", "Марка/ГОСТ", "Кол-во", "Ед.изм.", "Комментарий"]

    # 2. Создание HTML таблицы
    items_table_html = '<div style="overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 20px;">'
    items_table_html += '<table border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width: 800px; border-collapse: collapse; font-family: Helvetica Neue, Helvetica, Arial, sans-serif;">'
    
    items_table_html += '<thead><tr>'
    for h in headers:
        items_table_html += f'<th align="left" style="padding: 10px 15px; background-color: #f8f9fa; border-bottom: 1px solid #dee2e6; color: #495057; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;">{h}</th>'
    items_table_html += '</tr></thead>'

    items_table_html += '<tbody>'
    for item in items:
        items_table_html += '<tr>'
        
        data = {}
        if is_metal_only:
            assert item.kind == 'metal'
            data = {
                "Категория": "Металлопрокат", 
                "Наименование": item.category,
                "Размер": item.size, "ГОСТ": item.state_standard, 
                "Марка": item.stamp, "Аналоги": "Да" if item.allow_analogs else "Нет", 
                "Количество": item.quantity, 
                "Ед. изм.": item.unit or 'шт.',
                "Комментарий": item.comment
            }
        elif is_generic_only:
            assert item.kind == 'generic'
            data = {
                "Наименование": item.name, "Размеры, характеристики": item.dims, 
                "Ед. изм.": item.unit, "Количество": item.quantity, "Комментарий": item.comment
            }
        else:
            if item.kind == 'metal':
                data = {
                    "Категория": "Металлопрокат", 
                    "Наименование": item.category, 
                    "Размер/Характеристики": item.size, "Марка/ГОСТ": f"{item.stamp or ''} / {item.state_standard or ''}".strip(' /'),
                    "Кол-во": item.quantity, "Ед.изм.": item.unit or 'шт.', "Комментарий": item.comment
                }
            else:
                data = {
                    "Категория": item.category, "Наименование": item.name, 
                    "Размер/Характеристики": item.dims, "Марка/ГОСТ": "—",
                    "Кол-во": item.quantity, "Ед.изм.": item.unit, "Комментарий": item.comment
                }

        for header in headers:
            value = data.get(header, '—')
            if value is None or str(value).strip() == '': value = '—'
            items_table_html += f'<td style="padding: 15px; border-bottom: 1px solid #dee2e6; color: #343a40; font-size: 14px; white-space: nowrap;">{value}</td>'
        items_table_html += '</tr>'
    items_table_html += '</tbody></table></div>'


    meta_info = {
        "Номер заявки": f"№{req.display_id}",
        "Дата создания": req.created_at.strftime('%d.%m.%Y %H:%M'),
        "Название поставки": req.comment,
        "Дата и время поставки": req.delivery_at.strftime('%d.%m.%Y %H:%M') if req.delivery_at else '—',
        "Адрес поставки": req.delivery_address
    }
    meta_html = '<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">'
    meta_items = list(meta_info.items())
    for i in range(0, len(meta_items), 2):
        meta_html += '<tr>'
        key, value = meta_items[i]
        if value:
            meta_html += f'<td style="padding: 0 10px 15px 0; vertical-align: top;"><p style="margin: 0; color: #6c757d; font-size: 14px;">{key}:</p><p style="margin: 5px 0 0 0; color: #212529; font-size: 16px; font-weight: 600;">{value}</p></td>'
        if i + 1 < len(meta_items):
            key, value = meta_items[i+1]
            if value:
                meta_html += f'<td style="padding: 0 0 15px 10px; vertical-align: top;"><p style="margin: 0; color: #6c757d; font-size: 14px;">{key}:</p><p style="margin: 5px 0 0 0; color: #212529; font-size: 16px; font-weight: 600;">{value}</p></td>'
        else:
            meta_html += '<td style="padding: 0 0 15px 10px;"></td>'
        meta_html += '</tr>'
    meta_html += '</table>'

    default_header = """<p style=\"margin-bottom: 25px; color: #343a40; line-height: 1.7; font-size: 16px;\">Здравствуйте,</p>\n<p style=\"margin-bottom: 30px; color: #343a40; line-height: 1.7; font-size: 16px;\">Просим вас предоставить коммерческое предложение по следующим позициям. Для этого перейдите по ссылке выше.</p>"""
    default_footer = f"""<p style=\"margin-top: 30px; color: #343a40; line-height: 1.7; font-size: 16px;\">С уважением,<br>{user.login or 'Покупатель'}</p>"""

    header_html = header_text.replace('\n', '<br>') if header_text is not None else default_header
    footer_html = footer_text.replace('\n', '<br>') if footer_text is not None else default_footer

    counterparty_name = req.counterparty.short_name if req.counterparty else 'Запрос поставки'
    counterparty_inn = f"ИНН: {req.counterparty.inn}" if req.counterparty and req.counterparty.inn else ''

    html_content = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Запрос коммерческого предложения</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');</style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #ffffff; color: #212529;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 660px; margin: 0 auto;">
        <tr>
            <td style="padding: 30px 20px;">
                <h1 style="margin: 0 0 5px 0; font-size: 24px; font-weight: 700; color: #212529;">{counterparty_name}</h1>
                <p style="margin: 0; font-size: 16px; color: #6c757d;">{counterparty_inn}</p>
            </td>
        </tr>
        <tr><td style="padding: 0 20px;"><div style="height: 3px; background-color: #D97706; width: 100%;"></div></td></tr>
        <tr>
            <td style="padding: 40px 20px;">
                <h2 style="margin-top: 0; margin-bottom: 25px; font-size: 24px; color: #212529; font-weight: 600;">Запрос коммерческого предложения</h2>
                {meta_html}
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{request_url}" style="background-color: #D97706; color: #ffffff; padding: 15px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 600;">Посмотреть заявку и оставить предложение</a>
                </div>
                {header_html}
                {items_table_html}
                {footer_html}
            </td>
        </tr>
    </table>
</body>
</html>
"""
    return html_content



def _generate_award_email_html(
    req: Request,
    winning_offer: Offer,
    deal_url: str,
) -> str:
    counterparty_name = req.counterparty.short_name if req.counterparty else 'Запрос поставки'
    counterparty_inn = f"ИНН: {req.counterparty.inn}" if req.counterparty and req.counterparty.inn else ''

    html_content = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ваше предложение выбрано!</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');</style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #ffffff; color: #212529;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 660px; margin: 0 auto;">
        <tr>
            <td style="padding: 30px 20px;">
                <h1 style="margin: 0 0 5px 0; font-size: 24px; font-weight: 700; color: #212529;">{counterparty_name}</h1>
                <p style="margin: 0; font-size: 16px; color: #6c757d;">{counterparty_inn}</p>
            </td>
        </tr>
        <tr><td style="padding: 0 20px;"><div style="height: 3px; background-color: #D97706; width: 100%;"></div></td></tr>
        <tr>
            <td style="padding: 40px 20px;">
                <h2 style="margin-top: 0; margin-bottom: 25px; font-size: 24px; color: #212529; font-weight: 600;">Поздравляем! Ваше предложение выбрано!</h2>
                <p style="margin-bottom: 25px; color: #343a40; line-height: 1.7; font-size: 16px;">Здравствуйте, {winning_offer.supplier.short_name},</p>
                <p style="margin-bottom: 30px; color: #343a40; line-height: 1.7; font-size: 16px;">Ваше предложение по заявке №{req.display_id} было выбрано заказчиком.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{deal_url}" style="background-color: #D97706; color: #ffffff; padding: 15px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 600;">Перейти к сделке</a>
                </div>
                <p style="margin-top: 30px; color: #343a40; line-height: 1.7; font-size: 16px;">С уважением,<br>Команда KupecProject</p>
            </td>
        </tr>
    </table>
</body>
</html>
"""
    return html_content


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
        .options(
            selectinload(Request.items),
            selectinload(Request.offers).selectinload(Offer.items),
            selectinload(Request.offers).selectinload(Offer.supplier),
            joinedload(Request.counterparty)
        )
        .order_by(Request.created_at.desc())
    )
    rows = (await db.execute(q)).scalars().all()
    return rows

@router.get("/requests/{request_id}", response_model=RequestOut)
async def get_request_by_id(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Request)
        .where(Request.id == request_id)
        .options(
            selectinload(Request.items),
            selectinload(Request.offers).selectinload(Offer.items),
            selectinload(Request.offers).selectinload(Offer.supplier),
            joinedload(Request.counterparty)
        )
    )
    req = (await db.execute(q)).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return req

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
                unit=it.unit,
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
                unit=it.unit,
                name=it.name,
                note=it.note,
            )

        db.add(row)

    await db.commit()
    await db.refresh(req, attribute_names=["items", "counterparty", "offers"])
    return req

@router.post("/requests/{request_id}/offers", status_code=status.HTTP_201_CREATED)
async def create_offer(
    request_id: UUID,
    payload: OfferCreate,
    db: AsyncSession = Depends(get_db),
    token: UUID = Query(...),
):
    # 1. Валидация токена
    q = select(OfferToken).where(OfferToken.token == token)
    offer_token = (await db.execute(q)).scalar_one_or_none()

    if not offer_token:
        raise HTTPException(status_code=404, detail="Invalid or expired token")

    if offer_token.request_id != request_id:
        raise HTTPException(status_code=400, detail="Token does not match this request")

    if offer_token.is_used:
        raise HTTPException(status_code=400, detail="This offer has already been submitted")

    # 2. Проверка, что заявка существует
    q_req = select(Request).where(Request.id == request_id).options(selectinload(Request.items))
    req = (await db.execute(q_req)).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # 3. Проверка, что поставщик еще не делал предложение по этой заявке
    q_offer = select(Offer).where(Offer.request_id == request_id, Offer.supplier_id == offer_token.supplier_id)
    existing_offer = (await db.execute(q_offer)).scalar_one_or_none()
    if existing_offer:
        raise HTTPException(status_code=400, detail="An offer has already been submitted by this supplier")

    # 4. Создание Offer и OfferItem
    offer = Offer(
        request_id=request_id,
        supplier_id=offer_token.supplier_id,
        comment=payload.comment,
    )
    db.add(offer)
    await db.flush()

    # Проверяем, что все ID позиций в payload существуют в исходной заявке
    req_item_ids = {item.id for item in req.items}
    for item_payload in payload.items:
        if item_payload.request_item_id not in req_item_ids:
            raise HTTPException(
                status_code=422,
                detail=f"Item with id {item_payload.request_item_id} not found in this request"
            )
        offer_item = OfferItem(
            offer_id=offer.id,
            request_item_id=item_payload.request_item_id,
            price=item_payload.price,
        )
        db.add(offer_item)

    # 5. Помечаем токен как использованный и обновляем статус заявки
    offer_token.is_used = True
    req.status = "pending"
    await db.commit()

    return {"message": "Offer created successfully"}


@router.post("/requests/{request_id}/offers/{offer_id}/award", status_code=status.HTTP_200_OK)
async def award_offer(
    request_id: UUID,
    offer_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: Buyer = Depends(get_current_user),
):

    if not isinstance(user, Buyer):
        raise HTTPException(status_code=403, detail="Only buyers can award offers")

    q_req = select(Request).where(Request.id == request_id, Request.buyer_id == user.id).options(
        selectinload(Request.offers).selectinload(Offer.supplier),
        joinedload(Request.winner_offer).joinedload(Offer.supplier),
        joinedload(Request.counterparty)
    )
    req = (await db.execute(q_req)).scalar_one_or_none()

    if not req:
        raise HTTPException(status_code=404, detail="Request not found or access denied")

    if req.status == "awarded":
        raise HTTPException(status_code=400, detail="This request has already been awarded.")

    winning_offer = None
    for offer in req.offers:
        if offer.id == offer_id:
            winning_offer = offer
            break

    if not winning_offer:
        raise HTTPException(status_code=404, detail="Offer not found for this request")

    req.status = "awarded"
    req.winner_offer_id = winning_offer.id
    db.add(req)
    await db.commit()
    await db.refresh(req, attribute_names=["winner_offer", "offers"])

    if winning_offer.supplier and winning_offer.supplier.email:
        deal_url = f"{settings.FRONTEND_URL}/deals/{req.id}"
        subject_winner = f"Поздравляем! Ваше предложение по заявке №{req.display_id} выбрано!"
        content_winner = _generate_award_email_html(req=req, winning_offer=winning_offer, deal_url=deal_url)
        send_email_background(
            background_tasks=background_tasks,
            recipient_email=winning_offer.supplier.email,
            subject=subject_winner,
            content=content_winner,
        )

    for offer in req.offers:
        if offer.id != winning_offer.id and offer.supplier and offer.supplier.email:
            subject_loser = f"Обновление по заявке №{req.display_id}"
            content_loser = f"""
            <p>Здравствуйте, {offer.supplier.short_name},</p>
            <p>К сожалению, ваше предложение по заявке №{req.display_id} не было выбрано на этот раз.</p>
            <p>Благодарим вас за участие и надеемся на дальнейшее сотрудничество.</p>
            <p>С уважением,<br>Команда KupecProject</p>
            """
            send_email_background(
                background_tasks=background_tasks,
                recipient_email=offer.supplier.email,
                subject=subject_loser,
                content=content_loser,
            )

    return {"message": "Offer awarded successfully and suppliers notified."}


@router.post("/requests/{request_id}/send", status_code=status.HTTP_202_ACCEPTED)
async def archive_request_as_email(
    request_id: UUID,
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
    q = select(Request).where(Request.id == request_id, Request.buyer_id == user.id).options(selectinload(Request.items), joinedload(Request.counterparty))
    req = (await db.execute(q)).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found or access denied")

    # 2. Формируем тему и тело письма
    subject = f"Заявка №{req.display_id}: {req.comment or 'Без названия'}"
    
    items_html = "<ul>"
    for item in req.items:
        if item.kind == 'metal':
            details = f"{item.category or ''} {item.size or ''} {item.stamp or ''} {item.state_standard or ''}".strip()
            items_html += f"<li>{details} - {item.quantity} {item.unit or 'шт.'}</li>"
        else:
            items_html += f"<li>{item.name or 'Прочее'} - {item.quantity} {item.unit or 'шт.'}</li>"
    items_html += "</ul>"
    
    content = f"""<h3>Детали заявки:</h3>{items_html}"""

    # 3. Создаем запись в таблице Email
    email = Email(
        sender_buyer_id=user.id,
        receiver_buyer_id=user.id,  # Указываем получателя, чтобы пройти CHECK constraint
        subject=subject,
        content=content,
        excel_file_path=None
    )
    db.add(email)
    await db.commit()
    await db.refresh(email)

    return {"message": "Request has been sent and saved to your outbox.", "email_id": email.id}


@router.post("/requests/{request_id}/send-to-suppliers", status_code=status.HTTP_202_ACCEPTED)
async def send_request_to_suppliers(
    request_id: UUID,
    payload: SendToSuppliersPayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: Buyer = Depends(get_current_user),
):
    if not isinstance(user, Buyer):
        raise HTTPException(status_code=403, detail="Only buyers can send requests")

    q = select(Request).where(Request.id == request_id, Request.buyer_id == user.id).options(joinedload(Request.counterparty))
    req = (await db.execute(q)).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found or access denied")

    subject = f"Запрос коммерческого предложения по заявке №{req.display_id} от {req.created_at.strftime('%d.%m.%Y')}"
    total_emails_sent = 0

    all_supplier_ids = {sid for group in payload.groups for sid in group.supplier_ids}
    
    if all_supplier_ids:
        tokens_to_create = [{"request_id": req.id, "supplier_id": sid} for sid in all_supplier_ids]
        stmt = pg_insert(OfferToken).values(tokens_to_create)
        stmt = stmt.on_conflict_do_nothing(index_elements=['request_id', 'supplier_id'])
        await db.execute(stmt)
        await db.commit()

        q_tokens = select(OfferToken).where(
            OfferToken.request_id == req.id,
            OfferToken.supplier_id.in_(all_supplier_ids)
        )
        tokens_by_supplier_id = {t.supplier_id: t.token for t in (await db.execute(q_tokens)).scalars().all()}
        
        q_suppliers = select(Supplier).where(Supplier.id.in_(all_supplier_ids))
        suppliers_by_id = {s.id: s for s in (await db.execute(q_suppliers)).scalars().all()}
    else:
        tokens_by_supplier_id = {}
        suppliers_by_id = {}

    for group in payload.groups:
        recipient_emails = set(group.manual_emails)
        if not recipient_emails:
            for sid in group.supplier_ids:
                supplier = suppliers_by_id.get(sid)
                if supplier and supplier.email:
                    recipient_emails.add(supplier.email)

        if not recipient_emails:
            continue
        token_for_link = None
        if group.supplier_ids:
            primary_supplier_id = group.supplier_ids[0]
            token_for_link = tokens_by_supplier_id.get(primary_supplier_id)

        unique_items = list({item.id: item for item in group.items}.values())
        if not unique_items:
            continue
            
        html_content = _generate_email_html(
            unique_items, 
            req, 
            user, 
            header_text=group.email_header, 
            footer_text=group.email_footer, 
            token=token_for_link
        )

        for email in recipient_emails:
            send_email_background(
                background_tasks=background_tasks,
                recipient_email=email,
                subject=subject,
                content=html_content,
            )
            total_emails_sent += 1

    return {"message": f"Request sending process started for {total_emails_sent} recipients."}
