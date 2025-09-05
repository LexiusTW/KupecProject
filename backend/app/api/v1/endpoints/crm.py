# app/v1/endpoints/crm.py
from enum import Enum
from typing import Literal, List
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.crm import Chat, ChatParticipant, ChatMessage, Email
from app.core.websocket_manager import manager
from app.schemas.crm import ChatMessageOut, ChatMessageIn, ChatCreate, ChatOut, Role, EmailCreate, EmailOut

router = APIRouter()


@router.post("/chats/", response_model=ChatOut, status_code=status.HTTP_201_CREATED)
async def create_chat(payload: ChatCreate, db: AsyncSession = Depends(get_db)):
    chat = Chat()
    db.add(chat)
    await db.flush()  # получим chat.id без коммита

    db.add_all([
        ChatParticipant(chat_id=chat.id, buyer_id=payload.buyer_id, seller_id=None),
        ChatParticipant(chat_id=chat.id, buyer_id=None, seller_id=payload.seller_id),
    ])
    await db.commit()
    await db.refresh(chat)
    return chat

@router.get("/chats/for/{role}/{user_id}", response_model=List[ChatOut])
async def get_user_chats(role: Role, user_id: int, db: AsyncSession = Depends(get_db)):
    cp = ChatParticipant
    q = select(Chat).join(cp)
    if role == "buyer":
        q = q.where(cp.buyer_id == user_id)
    else:
        q = q.where(cp.seller_id == user_id)
    rows = (await db.execute(q)).scalars().all()
    return rows

@router.get("/chats/{chat_id}/messages", response_model=List[ChatMessageOut])
async def get_chat_messages(chat_id: int, db: AsyncSession = Depends(get_db)):
    q = select(ChatMessage).where(ChatMessage.chat_id == chat_id).order_by(ChatMessage.sent_at)
    rows = (await db.execute(q)).scalars().all()
    out = []
    for m in rows:
        if m.sender_buyer_id is not None:
            sender_role, sender_id = "buyer", m.sender_buyer_id
        else:
            sender_role, sender_id = "seller", m.sender_seller_id
        out.append(ChatMessageOut(
            id=m.id, chat_id=m.chat_id, content=m.content, sent_at=m.sent_at,
            sender_id=sender_id, sender_role=sender_role
        ))
    return out

@router.post("/chats/{chat_id}/messages", response_model=ChatMessageOut, status_code=201)
async def send_chat_message(chat_id: int, sender_role: Role, sender_id: int,
                            payload: ChatMessageIn, db: AsyncSession = Depends(get_db)):
    if sender_role == "buyer":
        msg = ChatMessage(chat_id=chat_id, sender_buyer_id=sender_id, content=payload.content)
    else:
        msg = ChatMessage(chat_id=chat_id, sender_seller_id=sender_id, content=payload.content)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    resp = ChatMessageOut(
        id=msg.id, chat_id=msg.chat_id, content=msg.content, sent_at=msg.sent_at,
        sender_id=sender_id, sender_role=sender_role
    )

    await manager.broadcast_to_chat(
        {"type": "chat_message", "data": resp.dict()},
        chat_id, db
    )
    return resp

@router.post("/emails/", response_model=EmailOut, status_code=status.HTTP_201_CREATED)
async def send_email(sender_role: Role, sender_id: int, payload: EmailCreate, db: AsyncSession = Depends(get_db)):
    if sender_role == "buyer":
        email = Email(
            subject=payload.subject, content=payload.content,
            sender_buyer_id=sender_id,
            receiver_buyer_id=payload.receiver_id if payload.receiver_role == "buyer" else None,
            receiver_seller_id=payload.receiver_id if payload.receiver_role == "seller" else None,
        )
    else:
        email = Email(
            subject=payload.subject, content=payload.content,
            sender_seller_id=sender_id,
            receiver_buyer_id=payload.receiver_id if payload.receiver_role == "buyer" else None,
            receiver_seller_id=payload.receiver_id if payload.receiver_role == "seller" else None,
        )
    db.add(email)
    await db.commit()
    await db.refresh(email)

    # пуш уведомления адресату
    await manager.send_personal_message(
        {
            "type": "new_email",
            "data": {"email_id": email.id, "subject": email.subject}
        },
        payload.receiver_role,
        payload.receiver_id,
    )
    return email

@router.get("/emails/inbox/{role}/{user_id}", response_model=List[EmailOut])
async def get_inbox(role: Role, user_id: int, db: AsyncSession = Depends(get_db)):
    q = select(Email)
    if role == "buyer":
        q = q.where(Email.receiver_buyer_id == user_id, Email.is_deleted == False)
    else:
        q = q.where(Email.receiver_seller_id == user_id, Email.is_deleted == False)
    q = q.order_by(Email.sent_at.desc())
    return (await db.execute(q)).scalars().all()

@router.get("/emails/sent/{role}/{user_id}", response_model=List[EmailOut])
async def get_sent(role: Role, user_id: int, db: AsyncSession = Depends(get_db)):
    q = select(Email)
    if role == "buyer":
        q = q.where(Email.sender_buyer_id == user_id)
    else:
        q = q.where(Email.sender_seller_id == user_id)
    q = q.order_by(Email.sent_at.desc())
    return (await db.execute(q)).scalars().all()

# ---------- WebSocket ----------
@router.websocket("/ws/chat/{role}/{user_id}")
async def websocket_chat_endpoint(websocket: WebSocket, role: Role, user_id: int, db: AsyncSession = Depends(get_db)):
    await manager.connect(websocket, role, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "chat_message":
                chat_id = int(data["chat_id"])
                content = str(data["content"])
                # сохраняем сообщение от инициатора
                if role == "buyer":
                    msg = ChatMessage(chat_id=chat_id, sender_buyer_id=user_id, content=content)
                else:
                    msg = ChatMessage(chat_id=chat_id, sender_seller_id=user_id, content=content)
                db.add(msg)
                await db.commit()
                await db.refresh(msg)
                # широковещательная отправка всем участникам чата
                await manager.broadcast_to_chat(
                    {"type": "chat_message", "data": {"id": msg.id, "chat_id": chat_id, "content": content}},
                    chat_id,
                    db,
                )
    except WebSocketDisconnect:
        await manager.disconnect(websocket, role, user_id)
