import os
from datetime import datetime
from pathlib import Path
from docxtpl import DocxTemplate
from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession
from docx2pdf import convert

from app.models.counterparty import Counterparty

router = APIRouter()

CONTRACTS_DIR = "contracts"
DOCX_TEMPLATE_PATH = "docx_template.docx"


def ensure_contracts_dir():
    """Создает директорию для контрактов, если она не существует."""
    Path(CONTRACTS_DIR).mkdir(exist_ok=True)


def _get_month_name_in_russian(month_number: int) -> str:
    """Возвращает название месяца на русском языке в родительном падеже."""
    months = {
        1: "января", 2: "февраля", 3: "марта", 4: "апреля", 5: "мая", 6: "июня",
        7: "июля", 8: "августа", 9: "сентября", 10: "октября", 11: "ноября", 12: "декабря"
    }
    return months.get(month_number, "")


def _prepare_context(counterparty: Counterparty) -> dict:
    """Подготавливает контекст для заполнения шаблона, используя только данные из Counterparty."""
    current_date = datetime.now()
    month_name = _get_month_name_in_russian(current_date.month)

    return {
        "contract_number": counterparty.id,
        "date": f"«{current_date.day:02}» {month_name} {current_date.year} г.",
        "short_name": counterparty.short_name or "",
        "inn": counterparty.inn or "",
        "kpp": counterparty.kpp or "",
        "ogrn": counterparty.ogrn or "",
        "legal_address": counterparty.legal_address or "",
        "bank_name": counterparty.bank_name or "",
        "bank_bik": counterparty.bank_bik or "",
        "bank_account": counterparty.bank_account or "",
        "bank_corr": counterparty.bank_corr or "",
        "director": counterparty.director or "",
        "phone": counterparty.phone or "",
        "email": counterparty.email or "",
    }


def _clear_old_files(counterparty_id: int):
    """
    Удаляет старые файлы с таким же ID, чтобы избежать дублирования.
    """
    for filename in os.listdir(CONTRACTS_DIR):
        if filename.startswith(f"contract_{counterparty_id}_"):
            os.remove(os.path.join(CONTRACTS_DIR, filename))


async def generate_contract_for_counterparty(counterparty_id: int, db: AsyncSession):
    """
    Генерирует документ Word на основе данных контрагента, сохраняет его,
    а затем конвертирует в PDF.
    """
    counterparty = await db.get(Counterparty, counterparty_id)
    if not counterparty:
        raise ValueError(f"Counterparty with ID {counterparty_id} not found")

    _clear_old_files(counterparty_id)

    context = _prepare_context(counterparty)
    
    doc = DocxTemplate(DOCX_TEMPLATE_PATH)
    doc.render(context)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    docx_filename = f"contract_{counterparty_id}_{timestamp}.docx"
    pdf_filename = f"contract_{counterparty_id}_{timestamp}.pdf"

    docx_path = os.path.join(CONTRACTS_DIR, docx_filename)
    pdf_path = os.path.join(CONTRACTS_DIR, pdf_filename)

    doc.save(docx_path)
    convert(docx_path, pdf_path)

    return docx_path, pdf_path