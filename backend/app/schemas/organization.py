from typing import Optional
from pydantic import BaseModel, constr, ConfigDict

class OrganizationBase(BaseModel):
    company_name: str
    inn: constr(min_length=10, max_length=12) #type: ignore
    ogrn: str
    legal_address: str
    director_name: str
    kpp: Optional[str] = None
    okpo: Optional[str] = None
    okato_oktmo: Optional[str] = None
    logo_url: Optional[str] = None
    bank_account: Optional[str] = None
    correspondent_account: Optional[str] = None
    bic: Optional[str] = None
    bank_name: Optional[str] = None

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationUpdate(OrganizationBase):
    pass

class OrganizationInDBBase(OrganizationBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class OrganizationSchema(OrganizationInDBBase):
    pass
