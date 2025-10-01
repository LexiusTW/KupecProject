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
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    counterparty_id = Column(Integer, ForeignKey("counterparties.id"), nullable=True)
    delivery_address = Column(String, nullable=True)
    comment = Column(String, nullable=True)
    delivery_at = Column(Date, nullable=True) # Дата поставки
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, nullable=False, server_default="Заявка создана")
    winner_offer_id = Column(Integer, ForeignKey("offers.id"), nullable=True)

    items = relationship("RequestItem", back_populates="request", cascade="all, delete-orphan")
    counterparty = relationship("Counterparty")
    offers = relationship("Offer", back_populates="request", foreign_keys="Offer.request_id", cascade="all, delete-orphan")
    winner_offer = relationship("Offer", foreign_keys=[winner_offer_id])
    comments = relationship("Comment", back_populates="request", cascade="all, delete-orphan")

class RequestItem(Base):
    __tablename__ = "request_items"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(UUID(as_uuid=True), ForeignKey("requests.id"), nullable=False)

    # общий блок
    kind = Column(String, nullable=True)        # "metal" | "generic"
    category = Column(String, nullable=True)    # пользовательская категория
    quantity = Column(Float, nullable=True)
    comment = Column(String, nullable=True)

    # НОВОЕ: универсальное строковое поле размера (для металла) и характеристики/ед.изм. (для generic)
    size = Column(String, nullable=True)        # для metal: "1x1x1" и т.п. (отображение)
    dims = Column(String, nullable=True)        # для generic: произвольные характеристики
    unit  = Column(String, nullable=True)        # для generic: ед. изм. (шт/м/кг/…)

    # блок только для metal:
    stamp = Column(String, nullable=True)
    state_standard = Column(String, nullable=True)  # ГОСТ/ТУ

    thickness = Column(Float, nullable=True)
    length = Column(Float, nullable=True)
    width = Column(Float, nullable=True)
    diameter = Column(Float, nullable=True)
    allow_analogs = Column(Boolean, nullable=True)

    # блок только для generic:
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

    # Новые поля для всего предложения
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
    price = Column(Float, nullable=False) # цена за единицу
    total_price = Column(Float, nullable=True)
    is_analogue = Column(Boolean, default=False, nullable=False)

    quantity = Column(Float, nullable=True)
    unit = Column(String, nullable=True)

    # generic
    name = Column(String, nullable=True)
    description = Column(String, nullable=True) # Размеры, характеристики

    # металлопрокат
    category = Column(String, nullable=True)
    size = Column(String, nullable=True)
    stamp = Column(String, nullable=True) # Марка
    state_standard = Column(String, nullable=True)  # ГОСТ

    offer = relationship("Offer", back_populates="items")
    request_item = relationship("RequestItem")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(UUID(as_uuid=True), ForeignKey("requests.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("Request", back_populates="comments")
    user = relationship("User", back_populates="comments")