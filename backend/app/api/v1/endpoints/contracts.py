from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import Buyer, Seller
from app.services.contracts import generate_contract_for_counterparty, ensure_contracts_dir
from app.schemas.contract import ContractGenerationResponse

router = APIRouter()


@router.post("/generate/{counterparty_id}", response_model=ContractGenerationResponse)
async def generate_contract_endpoint(
    counterparty_id: int,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    ensure_contracts_dir()

    if isinstance(user, Seller):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sellers cannot generate contracts")

    try:
        docx_path, pdf_path = await generate_contract_for_counterparty(counterparty_id, db)
        return ContractGenerationResponse(
            counterparty_id=counterparty_id,
            file_path=pdf_path or docx_path,
            message="Contract generated successfully"
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error generating contract: {str(e)}")

