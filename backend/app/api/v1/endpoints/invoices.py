from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import Seller
from app.services.invoices import generate_invoice_for_counterparty
from app.schemas.invoice import InvoiceGenerationResponse

router = APIRouter()


@router.post("/generate/{counterparty_id}", response_model=InvoiceGenerationResponse)
async def generate_invoice_endpoint(
    counterparty_id: int,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    if isinstance(user, Seller):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sellers cannot generate invoices")
    try:
        docx_path, pdf_path = await generate_invoice_for_counterparty(counterparty_id, db)
        return InvoiceGenerationResponse(
            counterparty_id=counterparty_id,
            file_path=pdf_path or docx_path,
            message="Invoice generated successfully",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error generating invoice: {str(e)}")


