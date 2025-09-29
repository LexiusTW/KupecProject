# app/v1/endpoints/crm.py
from enum import Enum
from typing import Literal, List
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.crm import Chat, ChatParticipant, ChatMessage, Email
from app.models.user import User
from app.core.websocket_manager import manager
from app.schemas.crm import ChatMessageOut, ChatMessageIn, ChatCreate, ChatOut, Role, EmailCreate, EmailOut

router = APIRouter()


@router.post("/chats/", response_model=ChatOut, status_code=status.HTTP_201_CREATED)
async def create_chat(payload: ChatCreate, db: AsyncSession = Depends(get_db)):
    chat = Chat()
    db.add(chat)
    await db.flush()  # получим chat.id без коммита

    db.add_all([
        ChatParticipant(chat_id=chat.id, user_id=payload.buyer_id),
        ChatParticipant(chat_id=chat.id, user_id=payload.seller_id),
    ])
    await db.commit()
    await db.refresh(chat)
    return chat

@router.get("/chats/for/{user_id}", response_model=List[ChatOut])
async def get_user_chats(user_id: int, db: AsyncSession = Depends(get_db)):
    cp = ChatParticipant
    q = select(Chat).join(cp).where(cp.user_id == user_id)
    rows = (await db.execute(q)).scalars().all()
    return rows

@router.get("/chats/{chat_id}/messages", response_model=List[ChatMessageOut])
async def get_chat_messages(chat_id: int, db: AsyncSession = Depends(get_db)):
    q = select(ChatMessage, User).join(User, ChatMessage.sender_id == User.id).where(ChatMessage.chat_id == chat_id).order_by(ChatMessage.sent_at)
    rows = (await db.execute(q)).all()
    out = []
    for m, sender in rows:
        out.append(ChatMessageOut(
            id=m.id, chat_id=m.chat_id, content=m.content, sent_at=m.sent_at,
            sender_id=m.sender_id, sender_role=sender.role
        ))
    return out

@router.post("/chats/{chat_id}/messages", response_model=ChatMessageOut, status_code=201)
async def send_chat_message(chat_id: int, sender_id: int,
                            payload: ChatMessageIn, db: AsyncSession = Depends(get_db)):
    sender = await db.get(User, sender_id)
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found")
    sender_role = sender.role

    msg = ChatMessage(chat_id=chat_id, sender_id=sender_id, content=payload.content)
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
async def send_email(sender_id: int, payload: EmailCreate, db: AsyncSession = Depends(get_db)):
    email = Email(
        subject=payload.subject, content=payload.content,
        sender_id=sender_id,
        receiver_id=payload.receiver_id,
    )
    db.add(email)
    await db.commit()
    await db.refresh(email)

    # We need receiver role to push notification
    receiver = await db.get(User, payload.receiver_id)
    if receiver:
        # пуш уведомления адресату
        await manager.send_personal_message(
            {
                "type": "new_email",
                "data": {"email_id": email.id, "subject": email.subject}
            },
            receiver.role,
            payload.receiver_id,
        )
    return email

@router.get("/emails/inbox/{user_id}", response_model=List[EmailOut])
async def get_inbox(user_id: int, db: AsyncSession = Depends(get_db)):
    q = select(Email).where(Email.receiver_id == user_id, Email.is_deleted == False).order_by(Email.sent_at.desc())
    return (await db.execute(q)).scalars().all()

@router.get("/emails/sent/{user_id}", response_model=List[EmailOut])
async def get_sent(user_id: int, db: AsyncSession = Depends(get_db)):
    q = select(Email).where(Email.sender_id == user_id).order_by(Email.sent_at.desc())
    return (await db.execute(q)).scalars().all()

# ---------- WebSocket ----------
@router.websocket("/ws/chat/{user_id}")
async def websocket_chat_endpoint(websocket: WebSocket, user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        # Close connection if user not found
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    role = user.role

    await manager.connect(websocket, role, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "chat_message":
                chat_id = int(data["chat_id"])
                content = str(data["content"])
                # сохраняем сообщение от инициатора
                msg = ChatMessage(chat_id=chat_id, sender_id=user_id, content=content)
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