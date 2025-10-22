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

    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    organization = relationship("Organization", back_populates="users")
    department = relationship("Department", back_populates="users")

    employee_name = Column(String, nullable=False)
    phone_number = Column(String, unique=True, nullable=True)

    delivery_address = Column(String(500), nullable=True)
    email_footer = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Каскадное удаление связанных сущностей
    comments = relationship("Comment", back_populates="user")
    counterparties = relationship("Counterparty", back_populates="user", cascade="all, delete-orphan")
    suppliers = relationship("Supplier", back_populates="user", cascade="all, delete-orphan")
    requests = relationship("Request", back_populates="user", cascade="all, delete-orphan")
    