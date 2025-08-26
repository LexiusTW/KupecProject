from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict
import json
import logging

from app.database import get_db, engine
from app.models import Base, User, Chat, ChatParticipant, ChatMessage, Email, Message
from app.schemas import (
    UserCreate, User as UserSchema,
    ChatCreate, Chat as ChatSchema,
    ChatMessageCreate, ChatMessage as ChatMessageSchema,
    EmailCreate, Email as EmailSchema,
    MessageCreate, Message as MessageSchema
)

Base.metadata.create_all(bind=engine)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CRM Система с чатом и почтой",
    description="Система для взаимодействия поставщиков с клиентами",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"Пользователь {user_id} подключился к WebSocket")
    
    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"Пользователь {user_id} отключился от WebSocket")
    
    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(message)
                except:
                    self.active_connections[user_id].remove(connection)
    
    async def broadcast_to_chat(self, message: str, chat_id: int, db: Session):
        chat_participants = db.query(ChatParticipant).filter(ChatParticipant.chat_id == chat_id).all()
        for participant in chat_participants:
            await self.send_personal_message(message, participant.user_id)

manager = ConnectionManager()

@app.post("/users/", response_model=UserSchema)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = User(**user.dict())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/users/", response_model=List[UserSchema])
def get_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@app.get("/users/{user_id}", response_model=UserSchema)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user

@app.post("/chats/", response_model=ChatSchema)
def create_chat(chat: ChatCreate, db: Session = Depends(get_db)):
    if len(chat.participant_ids) != 2:
        raise HTTPException(status_code=400, detail="Чат должен содержать ровно 2 участника")
    
    users = db.query(User).filter(User.id.in_(chat.participant_ids)).all()
    if len(users) != 2:
        raise HTTPException(status_code=404, detail="Один или несколько пользователей не найдены")
    
    db_chat = Chat()
    db.add(db_chat)
    db.commit()
    db.refresh(db_chat)
    
    for user_id in chat.participant_ids:
        participant = ChatParticipant(chat_id=db_chat.id, user_id=user_id)
        db.add(participant)
    
    db.commit()
    db.refresh(db_chat)
    return db_chat

@app.get("/chats/user/{user_id}", response_model=List[ChatSchema])
def get_user_chats(user_id: int, db: Session = Depends(get_db)):
    chats = db.query(Chat).join(ChatParticipant).filter(ChatParticipant.user_id == user_id).all()
    return chats

@app.get("/chats/{chat_id}/messages", response_model=List[ChatMessageSchema])
def get_chat_messages(chat_id: int, db: Session = Depends(get_db)):
    messages = db.query(ChatMessage).filter(ChatMessage.chat_id == chat_id).order_by(ChatMessage.sent_at).all()
    return messages

@app.post("/emails/", response_model=EmailSchema)
def send_email(email: EmailCreate, sender_id: int, db: Session = Depends(get_db)):
    receiver = db.query(User).filter(User.id == email.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Получатель не найден")
    
    db_email = Email(**email.dict(), sender_id=sender_id)
    db.add(db_email)
    db.commit()
    db.refresh(db_email)
    
    notification = {
        "type": "new_email",
        "data": {
            "email_id": db_email.id,
            "subject": db_email.subject,
            "sender_id": sender_id
            }
        }
    
    import asyncio
    try:
        asyncio.create_task(manager.send_personal_message(json.dumps(notification), email.receiver_id))
    except:
        pass
    
    return db_email

@app.get("/emails/inbox/{user_id}", response_model=List[EmailSchema])
def get_inbox(user_id: int, db: Session = Depends(get_db)):
    emails = db.query(Email).filter(
        Email.receiver_id == user_id,
        Email.is_deleted == False
    ).order_by(Email.sent_at.desc()).all()
    return emails

@app.get("/emails/sent/{user_id}", response_model=List[EmailSchema])
def get_sent_emails(user_id: int, db: Session = Depends(get_db)):
    emails = db.query(Email).filter(Email.sender_id == user_id).order_by(Email.sent_at.desc()).all()
    return emails

@app.websocket("/ws/chat/{user_id}")
async def websocket_chat_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data["type"] == "chat_message":
                db = next(get_db())
                try:
                    chat_message = ChatMessage(
                        chat_id=message_data["chat_id"],
                        sender_id=user_id,
                        content=message_data["content"]
                    )
                    db.add(chat_message)
                    db.commit()
                    db.refresh(chat_message)
                    
                    await manager.broadcast_to_chat(
                        json.dumps({
                            "type": "chat_message",
                            "data": {
                                "id": chat_message.id,
                                "chat_id": chat_message.chat_id,
                                "sender_id": chat_message.sender_id,
                                "content": chat_message.content,
                                "sent_at": chat_message.sent_at.isoformat()
                            }
                        }),
                        message_data["chat_id"],
                        db
                    )
                finally:
                    db.close()
                    
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

@app.post("/messages/", response_model=MessageSchema)
def send_message(message: MessageCreate, sender_id: int, db: Session = Depends(get_db)):
    receiver = db.query(User).filter(User.id == message.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Получатель не найден")
    
    db_message = Message(**message.dict(), sender_id=sender_id)
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    
    notification = {
        "type": "new_message",
        "data": {
            "message_id": db_message.id,
            "content": db_message.content,
            "sender_id": sender_id
        }
    }
    
    import asyncio
    try:
        asyncio.create_task(manager.send_personal_message(json.dumps(notification), message.receiver_id))
    except:
        pass
    
    return db_message

@app.get("/messages/inbox/{user_id}", response_model=List[MessageSchema])
def get_inbox_messages(user_id: int, db: Session = Depends(get_db)):
    messages = db.query(Message).filter(Message.receiver_id == user_id).order_by(Message.sent_at.desc()).all()
    return messages

@app.get("/messages/sent/{user_id}", response_model=List[MessageSchema])
def get_sent_messages(user_id: int, db: Session = Depends(get_db)):
    messages = db.query(Message).filter(Message.sender_id == user_id).order_by(Message.sent_at.desc()).all()
    return messages

@app.get("/")
def read_root():
    return {"message": "CRM Система с чатом и почтой", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
