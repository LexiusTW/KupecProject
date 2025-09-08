from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class ExcelGenerationResponse(BaseModel):
    request_id: int
    files_created: Dict[str, str]
    message: str


class PricingData(BaseModel):
    row_number: int
    price: Optional[float] = None
    raw_data: Dict[str, Any]


class ExcelReadResponse(BaseModel):
    filename: str
    pricing_data: List[PricingData]
    total_items: int
    items_with_prices: int


class FileListResponse(BaseModel):
    directory: str
    files: List[str]
    total_count: int
