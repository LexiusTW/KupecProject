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
    buyer_id = Column(Integer, ForeignKey("buyers.id", ondelete="CASCADE"), nullable=True)
    seller_id = Column(Integer, ForeignKey("sellers.id", ondelete="CASCADE"), nullable=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    chat = relationship("Chat", back_populates="participants")
    __table_args__ = (
        CheckConstraint(
            "(buyer_id IS NOT NULL AND seller_id IS NULL) OR (buyer_id IS NULL AND seller_id IS NOT NULL)",
            name="chk_participant_side"
        ),
    )

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    sender_buyer_id = Column(Integer, ForeignKey("buyers.id", ondelete="SET NULL"), nullable=True)
    sender_seller_id = Column(Integer, ForeignKey("sellers.id", ondelete="SET NULL"), nullable=True)
    content = Column(Text, nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    is_read = Column(Boolean, default=False)

    chat = relationship("Chat", back_populates="messages")
    __table_args__ = (
        CheckConstraint(
            "(sender_buyer_id IS NOT NULL AND sender_seller_id IS NULL) OR (sender_buyer_id IS NULL AND sender_seller_id IS NOT NULL)",
            name="chk_message_sender_side"
        ),
    )

class Email(Base):
    __tablename__ = "emails"
    id = Column(Integer, primary_key=True, index=True)
    sender_buyer_id = Column(Integer, ForeignKey("buyers.id", ondelete="SET NULL"), nullable=True)
    sender_seller_id = Column(Integer, ForeignKey("sellers.id", ondelete="SET NULL"), nullable=True)
    receiver_buyer_id = Column(Integer, ForeignKey("buyers.id", ondelete="SET NULL"), nullable=True)
    receiver_seller_id = Column(Integer, ForeignKey("sellers.id", ondelete="SET NULL"), nullable=True)
    subject = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    is_read = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
