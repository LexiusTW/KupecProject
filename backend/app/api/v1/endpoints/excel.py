import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user
from app.models.user import Buyer, Seller
from app.models.request import Request
from app.excel_processor import ExcelProcessor
from app.schemas.excel import ExcelGenerationResponse, ExcelReadResponse, FileListResponse

router = APIRouter()
excel_processor = ExcelProcessor()


@router.post("/excel/generate/{request_id}", response_model=ExcelGenerationResponse)
async def generate_excel_for_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user),
):
    if isinstance(user, Seller):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sellers cannot generate Excel files"
        )
    
    query = select(Request).where(Request.id == request_id)
    result = await db.execute(query)
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found"
        )
    
    if request.buyer_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only generate Excel for your own requests"
        )
    
    try:
        files_created = await excel_processor.generate_request_excel(request_id, db)
        
        return ExcelGenerationResponse(
            request_id=request_id,
            files_created=files_created,
            message=f"Excel files generated successfully. Created {len(files_created)} files."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating Excel files: {str(e)}"
        )


@router.post("/excel/upload", response_model=ExcelReadResponse)
async def upload_pricing_excel(
    file: UploadFile = File(...),
    user = Depends(get_current_user),
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Excel files (.xlsx, .xls) are allowed"
        )
    
    try:
        file_path = os.path.join(excel_processor.incoming_dir, file.filename)
        
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        pricing_data = excel_processor.read_pricing_excel(file_path)
        
        items_with_prices = sum(1 for item in pricing_data if item["price"] is not None)
        
        return ExcelReadResponse(
            filename=file.filename,
            pricing_data=pricing_data,
            total_items=len(pricing_data),
            items_with_prices=items_with_prices
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing Excel file: {str(e)}"
        )


@router.get("/excel/files/outgoing", response_model=FileListResponse)
async def list_outgoing_files(
    user = Depends(get_current_user),
):
    try:
        files = excel_processor.get_available_files("outgoing")
        return FileListResponse(
            directory="outgoing",
            files=files,
            total_count=len(files)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing outgoing files: {str(e)}"
        )


@router.get("/excel/files/incoming", response_model=FileListResponse)
async def list_incoming_files(
    user = Depends(get_current_user),
):
    try:
        files = excel_processor.get_available_files("incoming")
        return FileListResponse(
            directory="incoming",
            files=files,
            total_count=len(files)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing incoming files: {str(e)}"
        )


@router.get("/excel/read/{directory}/{filename}", response_model=ExcelReadResponse)
async def read_excel_file(
    directory: str,
    filename: str,
    user = Depends(get_current_user),
):
    if directory not in ["outgoing", "incoming"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Directory must be 'outgoing' or 'incoming'"
        )
    
    if not filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Excel files (.xlsx, .xls) are allowed"
        )
    
    try:
        if directory == "outgoing":
            file_path = os.path.join(excel_processor.outgoing_dir, filename)
        else:
            file_path = os.path.join(excel_processor.incoming_dir, filename)
        
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        pricing_data = excel_processor.read_pricing_excel(file_path)
        items_with_prices = sum(1 for item in pricing_data if item["price"] is not None)
        
        return ExcelReadResponse(
            filename=filename,
            pricing_data=pricing_data,
            total_items=len(pricing_data),
            items_with_prices=items_with_prices
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading Excel file: {str(e)}"
        )
