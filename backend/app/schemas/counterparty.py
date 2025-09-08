# backend/app/schemas/counterparty.py
from pydantic import BaseModel, ConfigDict, constr

class CounterpartyBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # Основное
    short_name: constr(strip_whitespace=True, min_length=2, max_length=255)
    legal_address: constr(strip_whitespace=True, min_length=3, max_length=500)
    ogrn: constr(pattern=r'^\d{13}(\d{2})?$', strip_whitespace=True) | None = None
    inn: constr(pattern=r'^\d{10}(\d{2})?$', strip_whitespace=True)          # 10 (юр.) или 12 (ИП)
    kpp: constr(pattern=r'^\d{9}$') | None = None
    okpo: constr(pattern=r'^\d{8}(\d{2})?$') | None = None
    okato: constr(strip_whitespace=True, min_length=1, max_length=20) | None = None

    # Банк
    bank_account: constr(pattern=r'^\d{20}$') | None = None
    bank_bik: constr(pattern=r'^\d{9}$') | None = None
    bank_name: constr(strip_whitespace=True, min_length=2, max_length=255) | None = None
    bank_corr: constr(pattern=r'^\d{20}$') | None = None

class CounterpartyCreate(CounterpartyBase):
    pass

class CounterpartyUpdate(CounterpartyBase):
    pass

class CounterpartyOut(CounterpartyBase):
    id: int
