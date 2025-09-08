import os
from datetime import datetime
from typing import List, Dict, Any, Optional
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils.dataframe import dataframe_to_rows
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.request import Request, RequestItem
from app.models.user import Buyer
from app.models.counterparty import Counterparty


class ExcelProcessor:
    def __init__(self):
        self.outgoing_dir = "/Users/elr1c180/Desktop/KupecProject/excel_outgoing"
        self.incoming_dir = "/Users/elr1c180/Desktop/KupecProject/excel_incoming"
        
    async def generate_request_excel(self, request_id: int, db: AsyncSession) -> Dict[str, str]:
        query = (
            select(Request)
            .where(Request.id == request_id)
            .options(
                selectinload(Request.items),
                selectinload(Request.counterparty)
            )
        )
        result = await db.execute(query)
        request = result.scalar_one_or_none()
        
        if not request:
            raise ValueError(f"Request {request_id} not found")
        
        buyer_query = select(Buyer).where(Buyer.id == request.buyer_id)
        buyer_result = await db.execute(buyer_query)
        buyer = buyer_result.scalar_one_or_none()
        
        if not buyer:
            raise ValueError(f"Buyer {request.buyer_id} not found")
        
        categories = {}
        for item in request.items:
            category = item.category or "Прочее"
            if category not in categories:
                categories[category] = []
            categories[category].append(item)
        
        files_created = {}
        
        for category, items in categories.items():
            filename = f"request_{request_id}_{category}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            filepath = os.path.join(self.outgoing_dir, filename)
            
            if category == "металлургия":
                self._create_metallurgy_excel(filepath, request, buyer, items)
            else:
                self._create_generic_excel(filepath, request, buyer, items)
            
            files_created[category] = filepath
        
        all_items = [item for items in categories.values() for item in items]
        general_filename = f"request_{request_id}_general_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        general_filepath = os.path.join(self.outgoing_dir, general_filename)
        self._create_general_excel(general_filepath, request, buyer, all_items)
        files_created["general"] = general_filepath
        
        return files_created
    
    def _create_metallurgy_excel(self, filepath: str, request: Request, buyer: Buyer, items: List[RequestItem]):
        wb = Workbook()
        ws = wb.active
        ws.title = "Заявка металлургия"
        
        headers = [
            "№", "Марка", "ГОСТ/ТУ", "Размер", "Толщина", "Длина", "Ширина", 
            "Диаметр", "Количество", "Разрешить аналоги", "Комментарий", "Цена"
        ]
        
        ws.append(headers)
        
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center")
        
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
        
        for idx, item in enumerate(items, 1):
            row_data = [
                idx,
                item.stamp or "",
                item.state_standard or "",
                item.size or "",
                item.thickness or "",
                item.length or "",
                item.width or "",
                item.diameter or "",
                item.quantity or "",
                "Да" if item.allow_analogs else "Нет",
                item.comment or "",
                ""
            ]
            ws.append(row_data)
        
        for col in ws.columns:
            max_length = 0
            column = col[0].column_letter
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column].width = adjusted_width
        
        wb.save(filepath)
    
    def _create_generic_excel(self, filepath: str, request: Request, buyer: Buyer, items: List[RequestItem]):
        wb = Workbook()
        ws = wb.active
        ws.title = "Заявка общая"
        
        headers = [
            "№", "Наименование", "Характеристики", "Ед.изм.", "Количество", "Комментарий", "Цена"
        ]
        
        ws.append(headers)
        
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center")
        
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
        
        for idx, item in enumerate(items, 1):
            row_data = [
                idx,
                item.name or "",
                item.dims or "",
                item.uom or "",
                item.quantity or "",
                item.comment or "",
                ""
            ]
            ws.append(row_data)
        
        for col in ws.columns:
            max_length = 0
            column = col[0].column_letter
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column].width = adjusted_width
        
        wb.save(filepath)
    
    def _create_general_excel(self, filepath: str, request: Request, buyer: Buyer, items: List[RequestItem]):
        wb = Workbook()
        ws = wb.active
        ws.title = "Общая заявка"
        
        ws.append(["ИНФОРМАЦИЯ О ЗАЯВКЕ"])
        ws.append(["ID заявки:", request.id])
        ws.append(["Покупатель:", buyer.company_name or buyer.email])
        ws.append(["Адрес доставки:", request.delivery_address or ""])
        ws.append(["Дата поставки:", request.delivery_at.strftime("%Y-%m-%d %H:%M") if request.delivery_at else ""])
        ws.append(["Комментарий:", request.comment or ""])
        ws.append([])
        
        metallurgy_items = [item for item in items if item.category == "металлургия"]
        generic_items = [item for item in items if item.category != "металлургия"]
        
        if metallurgy_items:
            ws.append(["МЕТАЛЛУРГИЯ"])
            headers = [
                "№", "Марка", "ГОСТ/ТУ", "Размер", "Толщина", "Длина", "Ширина", 
                "Диаметр", "Количество", "Разрешить аналоги", "Комментарий", "Цена"
            ]
            ws.append(headers)
            
            for idx, item in enumerate(metallurgy_items, 1):
                row_data = [
                    idx,
                    item.stamp or "",
                    item.state_standard or "",
                    item.size or "",
                    item.thickness or "",
                    item.length or "",
                    item.width or "",
                    item.diameter or "",
                    item.quantity or "",
                    "Да" if item.allow_analogs else "Нет",
                    item.comment or "",
                    ""
                ]
                ws.append(row_data)
            
            ws.append([])
        
        if generic_items:
            ws.append(["ОБЩИЕ ТОВАРЫ"])
            headers = [
                "№", "Наименование", "Характеристики", "Ед.изм.", "Количество", "Комментарий", "Цена"
            ]
            ws.append(headers)
            
            for idx, item in enumerate(generic_items, 1):
                row_data = [
                    idx,
                    item.name or "",
                    item.dims or "",
                    item.uom or "",
                    item.quantity or "",
                    item.comment or "",
                    ""
                ]
                ws.append(row_data)
        
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center")
        
        for row in ws.iter_rows():
            for cell in row:
                if cell.value in ["ИНФОРМАЦИЯ О ЗАЯВКЕ", "МЕТАЛЛУРГИЯ", "ОБЩИЕ ТОВАРЫ"]:
                    cell.font = Font(bold=True, size=14)
                elif cell.value in ["№", "Марка", "ГОСТ/ТУ", "Размер", "Толщина", "Длина", "Ширина", 
                                   "Диаметр", "Количество", "Разрешить аналоги", "Комментарий", "Цена",
                                   "Наименование", "Характеристики", "Ед.изм."]:
                    cell.font = header_font
                    cell.fill = header_fill
                    cell.alignment = header_alignment
        
        for col in ws.columns:
            max_length = 0
            column = col[0].column_letter
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column].width = adjusted_width
        
        wb.save(filepath)
    
    def read_pricing_excel(self, filepath: str) -> List[Dict[str, Any]]:
        try:
            df = pd.read_excel(filepath)
            pricing_data = []
            
            for index, row in df.iterrows():
                price_data = {
                    "row_number": index + 1,
                    "price": None,
                    "raw_data": row.to_dict()
                }
                
                for col in df.columns:
                    if "цена" in str(col).lower() or "price" in str(col).lower():
                        try:
                            price_value = row[col]
                            if pd.notna(price_value) and price_value != "":
                                price_data["price"] = float(price_value)
                        except (ValueError, TypeError):
                            pass
                
                pricing_data.append(price_data)
            
            return pricing_data
            
        except Exception as e:
            raise ValueError(f"Ошибка чтения Excel файла: {str(e)}")
    
    def get_available_files(self, directory: str) -> List[str]:
        if directory == "outgoing":
            target_dir = self.outgoing_dir
        elif directory == "incoming":
            target_dir = self.incoming_dir
        else:
            raise ValueError("Directory must be 'outgoing' or 'incoming'")
        
        if not os.path.exists(target_dir):
            return []
        
        files = []
        for filename in os.listdir(target_dir):
            if filename.endswith(('.xlsx', '.xls')):
                files.append(filename)
        
        return sorted(files)
