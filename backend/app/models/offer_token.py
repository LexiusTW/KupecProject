import uuid
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base_class import Base

class OfferToken(Base):
    __tablename__ = "offer_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False, index=True)
    request_id = Column(UUID(as_uuid=True), ForeignKey("requests.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint('request_id', 'supplier_id', name='_request_supplier_uc'),)
