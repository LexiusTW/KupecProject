from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship, Mapped

from app.db.base_class import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    
    # Обязательные данные организации
    company_name = Column(String, nullable=False)
    inn = Column(String, unique=True, index=True, nullable=False)
    ogrn = Column(String, nullable=False)
    legal_address = Column(String, nullable=False)
    director_name = Column(String, nullable=False)
    
    # Необязательные поля
    kpp = Column(String, nullable=True)
    okpo = Column(String, nullable=True)
    okato_oktmo = Column(String, nullable=True)

    # Логотип компании
    logo_url = Column(String, nullable=True)

    # Необязательные банковские реквизиты
    bank_account = Column(String, nullable=True)
    correspondent_account = Column(String, nullable=True)
    bic = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)

    # Связь с пользователями
    users = relationship("User", back_populates="organization")
