from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import Buyer, Seller
from app.services.contracts import generate_contract_for_counterparty, ensure_contracts_dir
import os
import glob
from app.schemas.contract import ContractGenerationResponse

router = APIRouter()

@router.get("/check/{counterparty_id}", response_model=ContractGenerationResponse)
async def check_contract_endpoint(
    counterparty_id: int,
    request: Request,
    user=Depends(get_current_user),
    
):
    if isinstance(user, Seller):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sellers cannot check contracts")

    contracts_dir = os.path.join(os.getcwd(), "contracts")
    pattern = os.path.join(contracts_dir, f"contract_{counterparty_id}_*.pdf")
    
    matching_files = glob.glob(pattern)

    if matching_files:
        file_path = matching_files[0]
        file_name = os.path.basename(file_path)
        contract_url = request.url_for("contracts", path=file_name)
        
        return ContractGenerationResponse(
            counterparty_id=counterparty_id,
            file_path=str(contract_url),
            message="Contract PDF found"
        )
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract PDF not found for this counterparty.")

@router.post("/generate/{counterparty_id}", response_model=ContractGenerationResponse)
async def generate_contract_endpoint(
    counterparty_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_contracts_dir()

    if isinstance(user, Seller):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sellers cannot generate contracts")

    try:
        docx_path, pdf_path = await generate_contract_for_counterparty(counterparty_id, db)
        
        if pdf_path:
            file_name = os.path.basename(pdf_path)
            contract_url = request.url_for("contracts", path=file_name)
        elif docx_path:
            file_name = os.path.basename(docx_path)
            contract_url = request.url_for("contracts", path=file_name)
        else:
            contract_url = None

        return ContractGenerationResponse(
            counterparty_id=counterparty_id,
            file_path=str(contract_url) if contract_url else None,
            message="Contract generated successfully"
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error generating contract: {str(e)}")
