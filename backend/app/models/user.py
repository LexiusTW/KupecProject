from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    login = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean(), default=True)
    role = Column(String, nullable=False)

    parent_id = Column(Integer, ForeignKey("users.id"))
    parent = relationship("User", remote_side=[id], backref="children")

    inn = Column(String, unique=True, index=True, nullable=True)
    company_name = Column(String, nullable=True)
    director_name = Column(String, nullable=True)
    phone_number = Column(String, unique=True, nullable=True)
    legal_address = Column(String, nullable=True)
    ogrn = Column(String, nullable=True)
    kpp = Column(String, nullable=True)
    okpo = Column(String, nullable=True)
    okato_oktmo = Column(String, nullable=True)

    employee_name = Column(String, nullable=False)
    bank_account = Column(String, nullable=True)
    correspondent_account = Column(String, nullable=True)
    bic = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)

    delivery_address = Column(String(500), nullable=True)
    email_footer = Column(Text, nullable=True)
    logo_url = Column(String, nullable=True)
