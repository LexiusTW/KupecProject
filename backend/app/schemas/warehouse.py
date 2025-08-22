from typing import Optional
from pydantic import BaseModel


class Warehouse(BaseModel):
    city :  Optional[str]
    phone_number : Optional[str]
    email : Optional[str]
    legal_entity : Optional[str]
    working_hours : Optional[str]

class WarehouseSchema(Warehouse):
    id : int