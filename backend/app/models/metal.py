from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint

from app.db.base_class import Base


class Metal(Base):
    __tablename__ = 'metal'
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=True) # Номенклатура
    state_standard = Column(String, nullable=True) # ГОСТ/ТУ
    category = Column(String, nullable=True) #категория
    stamp = Column(String, nullable=True) # Марка стали
    diameter = Column(Float, nullable=True)
    thickness = Column(Float, nullable=True) #толщина
    width = Column(Float, nullable=True)#ширина
    length = Column(Float, nullable=True)#длина
    material = Column(String, nullable=True) #материал
    price = Column(Float, nullable=True) #цена
    unit = Column(String, nullable=True) #еденица измерения
    price_updated_at = Column(DateTime, nullable=True) #дата и время, когда были обновлены данные
    comments = Column(String, nullable=True) #все для чего нет поля
    warehouse_id = Column(Integer, ForeignKey('warehouse.id'), nullable=False) #айди склада и связь с ним

class MetalGreen(Base):
    __tablename__ = 'metal_green'
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=True)
    state_standard = Column(String, nullable=True)
    category = Column(String, nullable=True)
    stamp = Column(String, nullable=True)
    diameter = Column(Float, nullable=True)
    thickness = Column(Float, nullable=True)
    width = Column(Float, nullable=True)
    length = Column(Float, nullable=True)
    material = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    price_updated_at = Column(DateTime, nullable=True)
    comments = Column(String, nullable=True)
    warehouse_id = Column(Integer, ForeignKey('warehouse_green.id'), nullable=False)
