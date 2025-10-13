import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Tuple
from docxtpl import DocxTemplate
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.counterparty import Counterparty


INVOICES_DIR = "../../../invoices"
PDF_SOURCE_PATH = "../../../contracts/ОКБ_ЕКБ_СчетNo_ССПЕ_ДСБ5756_от_30_09_2025.pdf"
DOCX_TEMPLATE_PATH = "../../../invoices/invoice_template.docx"


def ensure_invoices_dir():
    Path(INVOICES_DIR).mkdir(exist_ok=True)


def _convert_pdf_to_docx(pdf_path: str, docx_out_path: str) -> bool:
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if soffice:
        try:
            outdir = os.path.dirname(docx_out_path)
            subprocess.run([soffice, "--headless", "--convert-to", "docx", "--outdir", outdir, pdf_path], check=True)
            return os.path.exists(docx_out_path)
        except Exception:
            pass
    try:
        import pypandoc
        pypandoc.convert_file(pdf_path, "docx", outputfile=docx_out_path)
        return os.path.exists(docx_out_path)
    except Exception:
        return False


def _prepare_context(counterparty: Counterparty) -> dict:
    now = datetime.now()
    return {
        "invoice_number": f"{counterparty.id}-{now.strftime('%Y%m%d')}",
        "invoice_date": now.strftime("%d.%m.%Y"),
        "short_name": counterparty.short_name or "",
        "inn": counterparty.inn or "",
        "kpp": counterparty.kpp or "",
        "ogrn": counterparty.ogrn or "",
        "legal_address": counterparty.legal_address or "",
        "bank_name": counterparty.bank_name or "",
        "bank_bik": counterparty.bank_bik or "",
        "bank_account": counterparty.bank_account or "",
        "bank_corr": counterparty.bank_corr or "",
        "director": getattr(counterparty, "director", "") or "",
        "phone": getattr(counterparty, "phone", "") or "",
        "email": getattr(counterparty, "email", "") or "",
        "total_sum": "",
        "total_sum_text": "",
    }


def _convert_to_pdf(docx_path: str, pdf_path: str) -> bool:
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if soffice:
        try:
            subprocess.run([soffice, "--headless", "--convert-to", "pdf", "--outdir", os.path.dirname(pdf_path), docx_path], check=True)
            return os.path.exists(pdf_path)
        except Exception:
            pass
    try:
        from docx2pdf import convert as docx2pdf_convert
        docx2pdf_convert(docx_path, pdf_path)
        return os.path.exists(pdf_path)
    except Exception:
        return False


async def generate_invoice_for_counterparty(counterparty_id: int, db: AsyncSession) -> Tuple[str, str]:
    ensure_invoices_dir()
    counterparty = await db.get(Counterparty, counterparty_id)
    if not counterparty:
        raise ValueError(f"Counterparty with ID {counterparty_id} not found")

    if not os.path.exists(DOCX_TEMPLATE_PATH):
        _ = _convert_pdf_to_docx(PDF_SOURCE_PATH, DOCX_TEMPLATE_PATH)

    if not os.path.exists(DOCX_TEMPLATE_PATH):
        raise ValueError("Invoice DOCX template not found. Place invoice_template.docx into invoices directory with placeholders.")

    context = _prepare_context(counterparty)
    doc = DocxTemplate(DOCX_TEMPLATE_PATH)
    doc.render(context)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    docx_name = f"invoice_{counterparty_id}_{ts}.docx"
    pdf_name = f"invoice_{counterparty_id}_{ts}.pdf"
    docx_path = os.path.join(INVOICES_DIR, docx_name)
    pdf_path = os.path.join(INVOICES_DIR, pdf_name)

    doc.save(docx_path)
    ok = _convert_to_pdf(docx_path, pdf_path)
    return docx_path, pdf_path if ok else ""


