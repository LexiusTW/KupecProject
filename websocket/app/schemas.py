from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: str
    full_name: str
    role: str = "client"

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class ChatBase(BaseModel):
    pass

class ChatCreate(ChatBase):
    participant_ids: List[int]

class Chat(ChatBase):
    id: int
    created_at: datetime
    is_active: bool
    participants: List["ChatParticipant"]
    
    class Config:
        from_attributes = True

class ChatParticipant(BaseModel):
    id: int
    user_id: int
    joined_at: datetime
    user: User
    
    class Config:
        from_attributes = True

class ChatMessageBase(BaseModel):
    content: str

class ChatMessageCreate(ChatMessageBase):
    chat_id: int

class ChatMessage(ChatMessageBase):
    id: int
    chat_id: int
    sender_id: int
    sent_at: datetime
    is_read: bool
    sender: User
    
    class Config:
        from_attributes = True

class EmailBase(BaseModel):
    subject: str
    content: str

class EmailCreate(EmailBase):
    receiver_id: int

class Email(EmailBase):
    id: int
    sender_id: int
    receiver_id: int
    sent_at: datetime
    is_read: bool
    is_deleted: bool
    sender: User
    receiver: User
    
    class Config:
        from_attributes = True

class MessageBase(BaseModel):
    content: str

class MessageCreate(MessageBase):
    receiver_id: int

class Message(MessageBase):
    id: int
    sender_id: int
    receiver_id: int
    sent_at: datetime
    is_read: bool
    sender: User
    receiver: User
    
    class Config:
        from_attributes = True

class WebSocketMessage(BaseModel):
    type: str
    data: dict

class ChatWebSocketMessage(BaseModel):
    chat_id: int
    content: str
    sender_id: int
