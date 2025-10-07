from pydantic import BaseModel
from typing import Optional

class ContractGenerationResponse(BaseModel):
    counterparty_id: int
    file_path: str
    message: str


class ContractDataSchema(BaseModel):
    contract_number: Optional[int] = None
    date: Optional[str] = None
    director: Optional[str] = None
    short_name: Optional[str] = None
    legal_address: Optional[str] = None
    inn: Optional[int] = None
    kpp: Optional[int] = None
    bank_account: Optional[int] = None
    bank_name: Optional[str] = None
    bank_corr: Optional[int] = None
    bank_bik: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None