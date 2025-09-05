from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, func, Boolean
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Request(Base):
    __tablename__ = "requests"

    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("buyers.id"), nullable=False)
    delivery_address = Column(String, nullable=True)
    comment = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("RequestItem", back_populates="request", cascade="all, delete-orphan")

class RequestItem(Base):
    __tablename__ = "request_items"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("requests.id"), nullable=False)

    # общий блок
    kind = Column(String, nullable=True)        # "metal" | "generic"
    category = Column(String, nullable=True)    # пользовательская категория
    quantity = Column(Float, nullable=True)
    comment = Column(String, nullable=True)

    # НОВОЕ: универсальное строковое поле размера (для металла) и характеристики/ед.изм. (для generic)
    size = Column(String, nullable=True)        # для metal: "1x1x1" и т.п. (отображение)
    dims = Column(String, nullable=True)        # для generic: произвольные характеристики
    uom  = Column(String, nullable=True)        # для generic: ед. изм. (шт/м/кг/…)

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
