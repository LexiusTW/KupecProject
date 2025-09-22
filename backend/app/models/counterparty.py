# app/models/counterparty.py
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Counterparty(Base):
    __tablename__ = "counterparties"

    id = Column(Integer, primary_key=True, index=True)

    # связь с покупателем
    buyer_id = Column(Integer, ForeignKey("buyers.id", ondelete="CASCADE"), index=True, nullable=False)

    # Основное
    short_name = Column(String(255), nullable=False)        # Краткое наименование юр. лица
    legal_address = Column(String(500), nullable=False)     # Юридический адрес
    ogrn = Column(String(15), nullable=True)                # огрн 13/15 цифр
    inn = Column(String(12), nullable=False)                # инн 10/12 цифр
    kpp = Column(String(9), nullable=True)                  # кпп
    okpo = Column(String(10), nullable=True)                # окпо
    okato = Column(String(20), nullable=True)               # окато/октмо
 
        # Банк
    bank_account = Column(String(32), nullable=True)        # расчётный счёт
    bank_bik = Column(String(9), nullable=True)             # БИК
    bank_name = Column(String(255), nullable=True)          # Наименование банка банка
    bank_corr = Column(String(20), nullable=True)           # корр. счёт

    # Новые поля для договора
    director = Column(String(255), nullable=False)            # Директор
    phone = Column(String(50), nullable=False)                # Телефон
    email = Column(String(255), nullable=False)               # Электронная почта

    buyer = relationship("Buyer", backref="counterparties")
