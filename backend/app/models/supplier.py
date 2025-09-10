from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("buyers.id"), nullable=False) # Связь с покупателем, который добавил поставщика

    short_name = Column(String(255), nullable=False)        # Краткое наименование юр. лица
    legal_address = Column(String(500), nullable=False)     # Юридический адрес
    ogrn = Column(String(15), nullable=True)                # огрн 13/15 цифр
    inn = Column(String(12), nullable=False)                # инн 10/12 цифр
    kpp = Column(String(9), nullable=True)                  # кпп
    okpo = Column(String(10), nullable=True)                # окпо
    okato = Column(String(20), nullable=True)               # окато/октмо
    contact_person = Column(String, nullable=True)          # ФИО контактного лица
    phone_number = Column(String, nullable=True)            # Телефон
    email = Column(String, nullable=True)                   # Почта

    buyer = relationship("Buyer")