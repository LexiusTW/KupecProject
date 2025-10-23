from pydantic import BaseModel


class InvoiceGenerationResponse(BaseModel):
    counterparty_id: int
    file_path: str
    message: str

