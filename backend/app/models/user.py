from sqlalchemy import Boolean, Column, Integer, String

from app.db.base_class import Base


class Buyer(Base):
    __tablename__ = "buyers"

    id = Column(Integer, primary_key=True, index=True)
    login = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean(), default=True)
    role = Column(String, nullable=False)
    delivery_address = Column(String, nullable=True)


class Seller(Base):
    __tablename__ = "sellers"

    id = Column(Integer, primary_key=True, index=True)
    login = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    inn = Column(String, unique=True, index=True, nullable=False)
    director_name = Column(String, nullable=False)
    phone_number = Column(String, unique=True, nullable=False)
    legal_address = Column(String, nullable=False)
    is_active = Column(Boolean(), default=True)
    role = Column(String, nullable=False)
