from pydantic import BaseModel, ConfigDict
from typing import List, Literal, Optional
from datetime import datetime


Role = Literal["buyer", "seller"]


class ChatCreate(BaseModel):
    buyer_id: int
    seller_id: int

class ChatOut(BaseModel):
    id: int
    is_active: bool
    
    class SomeSchema(BaseModel):
        model_config = ConfigDict(from_attributes=True)

class ChatMessageIn(BaseModel):
    content: str

class ChatMessageOut(BaseModel):
    id: int
    chat_id: int
    content: str
    sent_at: Optional[datetime] = None
    sender_id: int
    sender_role: Role
    
    class SomeSchema(BaseModel):
        model_config = ConfigDict(from_attributes=True)

class EmailCreate(BaseModel):
    subject: str
    content: str
    receiver_role: Role
    receiver_id: int

class EmailOut(BaseModel):
    id: int
    subject: str
    content: str
    sent_at: datetime
    is_read: bool
    excel_file_path: Optional[str] = None
    
    class SomeSchema(BaseModel):
        model_config = ConfigDict(from_attributes=True)