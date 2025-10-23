from sqlalchemy import Column, Integer, JSON
from app.db.base_class import Base

class Contract(Base):
    __tablename__ = "contracts"
    id = Column(Integer, primary_key=True, index=True)
    data = Column(JSON)
