from pydantic import BaseModel


class ContractGenerationResponse(BaseModel):
    counterparty_id: int
    file_path: str
    message: str

