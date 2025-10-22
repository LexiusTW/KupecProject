from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Counterparty(Base):
    __tablename__ = "counterparties"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    short_name = Column(String(255), nullable=False)
    legal_address = Column(String(500), nullable=False)
    ogrn = Column(String(15), nullable=True)
    inn = Column(String(12), nullable=False)
    kpp = Column(String(9), nullable=True)
    okpo = Column(String(10), nullable=True)
    okato = Column(String(20), nullable=True)
    bank_account = Column(String(32), nullable=True)
    bank_bik = Column(String(9), nullable=True)
    bank_name = Column(String(255), nullable=True)
    bank_corr = Column(String(20), nullable=True)
    director = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    email = Column(String(255), nullable=False)

    user = relationship("User", back_populates="counterparties")
