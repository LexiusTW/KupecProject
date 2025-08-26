from pydantic import BaseModel
from typing import List, Optional
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

    class Config:
        from_attributes = True


class EmailBase(BaseModel):
    receiver_id: int
    subject: str
    content: str


class EmailCreate(EmailBase):
    pass


class Email(EmailBase):
    id: int
    sender_id: int
    sent_at: datetime
    is_read: bool
    is_deleted: bool

    class Config:
        from_attributes = True


class MessageBase(BaseModel):
    receiver_id: int
    content: str


class MessageCreate(MessageBase):
    pass


class Message(MessageBase):
    id: int
    sender_id: int
    sent_at: datetime
    is_read: bool

    class Config:
        from_attributes = True


class WebSocketMessage(BaseModel):
    type: str
    data: dict
