from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint

from app.db.base_class import Base

class Warehouse(Base):
    __tablename__ = 'warehouse'
    id = Column(Integer, primary_key=True)
    city = Column(String, nullable=False) #город в котором находится склад
    supplier = Column(String, nullable=False)
    phone_number = Column(String, nullable=True) #номер телефона
    email = Column(String, nullable=True) #email
    legal_entity = Column(String, nullable=True) #Юр. лицо
    working_hours = Column(String, nullable=True) #Время работы

    __table_args__ = (UniqueConstraint('city', 'supplier', name='_city_supplier_uc'),)
    
class WarehouseGreen(Base):
    __tablename__ = 'warehouse_green'
    id = Column(Integer, primary_key=True)
    city = Column(String, nullable=False)
    supplier = Column(String, nullable=False)
    phone_number = Column(String, nullable=True)
    email = Column(String, nullable=True)
    legal_entity = Column(String, nullable=True)
    working_hours = Column(String, nullable=True)

    __table_args__ = (UniqueConstraint('city', 'supplier', name='_city_supplier_green_uc'),)