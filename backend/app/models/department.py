from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    rop_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    rop = relationship("User", foreign_keys=[rop_id])
    users = relationship("User", back_populates="department", foreign_keys="User.department_id")


