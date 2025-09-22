from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("buyers.id"), nullable=False) # Связь с покупателем, который добавил поставщика

    short_name = Column(String(255), nullable=False)        # Краткое наименование юр. лица
    legal_address = Column(String(500), nullable=False)     # Юридический адрес
    ogrn = Column(String(15), nullable=False)                # огрн 13/15 цифр
    inn = Column(String(12), nullable=False)                # инн 10/12 цифр
    kpp = Column(String(9), nullable=False)                  # кпп
    okpo = Column(String(10), nullable=False)                # окпо
    okato = Column(String(20), nullable=False)               # окато/октмо
    contact_person = Column(String, nullable=False)         # ФИО контактного лица
    phone_number = Column(String, nullable=False)           # Телефон
    email = Column(String, nullable=False)                  # Почта
    category = Column(String(100), nullable=False)          # Категория поставщика (именительный падеж)

    buyer = relationship("Buyer")