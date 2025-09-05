from pydantic import BaseModel
from typing import List, Literal, Optional
from datetime import datetime


Role = Literal["buyer", "seller"]


class ChatCreate(BaseModel):
    buyer_id: int
    seller_id: int

class ChatOut(BaseModel):
    id: int
    is_active: bool
    class Config: from_attributes = True

class ChatMessageIn(BaseModel):
    content: str

class ChatMessageOut(BaseModel):
    id: int
    chat_id: int
    content: str
    sent_at: Optional[datetime] = None
    sender_id: int
    sender_role: Role
    class Config: from_attributes = True

class EmailCreate(BaseModel):
    subject: str
    content: str
    receiver_role: Role
    receiver_id: int

class EmailOut(BaseModel):
    id: int
    subject: str
    content: str
    class Config: from_attributes = True