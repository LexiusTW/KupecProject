import uuid
from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, func, Boolean, Sequence, Date, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base_class import Base

request_display_id_seq = Sequence('request_display_id_seq')

class Request(Base):
    __tablename__ = "requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    display_id = Column(Integer, server_default=request_display_id_seq.next_value(), nullable=False, unique=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    counterparty_id = Column(Integer, ForeignKey("counterparties.id"), nullable=True)
    delivery_address = Column(String, nullable=True)
    comment = Column(String, nullable=True)
    delivery_at = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    status = Column(String, nullable=False, server_default="Заявка создана")
    winner_offer_id = Column(Integer, ForeignKey("offers.id", use_alter=True), nullable=True)

    user = relationship("User", back_populates="requests")
    items = relationship("RequestItem", back_populates="request", cascade="all, delete-orphan")
    counterparty = relationship("Counterparty")
    offers = relationship("Offer", back_populates="request", foreign_keys="Offer.request_id", cascade="all, delete-orphan")
    winner_offer = relationship("Offer", foreign_keys=[winner_offer_id])
    comments = relationship("Comment", back_populates="request", cascade="all, delete-orphan")
    selected_offers = relationship("SelectedOffer", back_populates="request", cascade="all, delete-orphan")

class RequestItem(Base):
    __tablename__ = "request_items"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(UUID(as_uuid=True), ForeignKey("requests.id"), nullable=False)

    kind = Column(String, nullable=True)
    category = Column(String, nullable=True)
    quantity = Column(Float, nullable=True)
    comment = Column(String, nullable=True)

    size = Column(String, nullable=True)
    dims = Column(String, nullable=True)
    unit  = Column(String, nullable=True)

    stamp = Column(String, nullable=True)
    state_standard = Column(String, nullable=True)

    thickness = Column(Float, nullable=True)
    length = Column(Float, nullable=True)
    width = Column(Float, nullable=True)
    diameter = Column(Float, nullable=True)
    allow_analogs = Column(Boolean, nullable=True)

    name = Column(String, nullable=True)
    note = Column(String, nullable=True)

    request = relationship("Request", back_populates="items")

from app.models.supplier import Supplier
from app.models.user import User

class Offer(Base):
    __tablename__ = "offers"
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(UUID(as_uuid=True), ForeignKey("requests.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    comment = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    delivery_option = Column(String, nullable=False)
    vat_option = Column(String, nullable=False)
    invoice_file_path = Column(String, nullable=False)
    invoice_expires_at = Column(Date, nullable=False)
    contract_file_path = Column(String, nullable=True)

    request = relationship("Request", back_populates="offers", foreign_keys=[request_id])
    supplier = relationship("Supplier")
    items = relationship("OfferItem", back_populates="offer", cascade="all, delete-orphan")

class OfferItem(Base):
    __tablename__ = "offer_items"
    id = Column(Integer, primary_key=True, index=True)
    offer_id = Column(Integer, ForeignKey("offers.id"), nullable=False)
    request_item_id = Column(Integer, ForeignKey("request_items.id"), nullable=False)
    price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=True)
    is_analogue = Column(Boolean, default=False, nullable=False)

    quantity = Column(Float, nullable=True)
    unit = Column(String, nullable=True)

    name = Column(String, nullable=True)
    description = Column(String, nullable=True)
    
    category = Column(String, nullable=True)
    size = Column(String, nullable=True)
    stamp = Column(String, nullable=True)
    state_standard = Column(String, nullable=True)

    offer = relationship("Offer", back_populates="items")
    request_item = relationship("RequestItem")


class SelectedOffer(Base):
    __tablename__ = "selected_offers"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(UUID(as_uuid=True), ForeignKey("requests.id", ondelete="CASCADE"), nullable=False)
    request_item_id = Column(Integer, ForeignKey("request_items.id", ondelete="CASCADE"), nullable=False)

    supplier_name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    markup = Column(Float, nullable=True)

    delivery_included = Column(Boolean, default=False)
    delivery_time = Column(String, nullable=True)
    vat_included = Column(Boolean, default=False)
    comment = Column(String, nullable=True)
    company_type = Column(String, nullable=True)
    payment_type = Column(String, nullable=True)
    supplier_status = Column(String, nullable=False, server_default="В работе")

    request = relationship("Request", back_populates="selected_offers")
    request_item = relationship("RequestItem")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(UUID(as_uuid=True), ForeignKey("requests.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("Request", back_populates="comments")
    user = relationship("User", back_populates="comments")