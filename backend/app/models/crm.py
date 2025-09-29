# app/models/crm.py
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, CheckConstraint, func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Chat(Base):
    __tablename__ = "chats"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    participants = relationship("ChatParticipant", back_populates="chat", cascade="all, delete-orphan")
    messages = relationship("ChatMessage", back_populates="chat", cascade="all, delete-orphan")

class ChatParticipant(Base):
    __tablename__ = "chat_participants"
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    chat = relationship("Chat", back_populates="participants")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content = Column(Text, nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    is_read = Column(Boolean, default=False)

    chat = relationship("Chat", back_populates="messages")

class Email(Base):
    __tablename__ = "emails"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    receiver_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    subject = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    is_read = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    excel_file_path = Column(String, nullable=True) # Путь к сгенерированному Excel файлу