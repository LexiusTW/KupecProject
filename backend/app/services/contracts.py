import os
from datetime import datetime
from typing import Dict, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_COLOR_INDEX

from app.models.counterparty import Counterparty
from app.models.user import Buyer


CONTRACTS_DIR = "/Users/elr1c180/Desktop/KupecProject/contracts"
TEMPLATE_PATH = "/Users/elr1c180/Desktop/KupecProject/Договор_поставки_ТиО_2020_с_клиентом.docx"


def ensure_contracts_dir() -> str:
    os.makedirs(CONTRACTS_DIR, exist_ok=True)
    return CONTRACTS_DIR


def _counterparty_to_context(counterparty: Counterparty, buyer: Buyer) -> Dict[str, str]:
    return {
        "short_name": counterparty.short_name or "",
        "inn": counterparty.inn or "",
        "kpp": counterparty.kpp or "",
        "ogrn": counterparty.ogrn or "",
        "legal_address": counterparty.legal_address or "",
        "bank_name": counterparty.bank_name or "",
        "bank_bik": counterparty.bank_bik or "",
        "bank_account": counterparty.bank_account or "",
        "bank_corr": counterparty.bank_corr or "",
        "buyer_name": getattr(buyer, "company_name", None) or getattr(buyer, "email", ""),
        "date": datetime.now().strftime("%d.%m.%Y"),
    }


def _is_green_run(run) -> bool:
    if run.font.highlight_color == WD_COLOR_INDEX.GREEN:
        return True
    c = run.font.color
    if c is not None and c.rgb is not None:
        rgb = c.rgb
        if str(rgb).upper() in {"00B050", "00FF00", "008000"}:
            return True
    return False


def _extract_key(text: str) -> str:
    t = text.strip()
    if t.startswith("{{") and t.endswith("}}"):
        return t[2:-2].strip().lower()
    return t.strip().lower()


def _fill_docx_green_markers(doc: Document, context: Dict[str, str]) -> None:
    for p in doc.paragraphs:
        for r in p.runs:
            if _is_green_run(r):
                key = _extract_key(r.text)
                if key in context:
                    r.text = context[key]
                    r.font.highlight_color = None
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    for r in p.runs:
                        if _is_green_run(r):
                            key = _extract_key(r.text)
                            if key in context:
                                r.text = context[key]
                                r.font.highlight_color = None


def _convert_docx_to_pdf(docx_path: str, pdf_path: str) -> bool:
    try:
        from docx2pdf import convert
        convert(docx_path, pdf_path)
        return os.path.exists(pdf_path)
    except Exception:
        return False


async def generate_contract_for_counterparty(counterparty_id: int, db: AsyncSession) -> Tuple[str, str]:
    ensure_contracts_dir()
    q = select(Counterparty).where(Counterparty.id == counterparty_id)
    counterparty = (await db.execute(q)).scalar_one_or_none()
    if not counterparty:
        raise ValueError("Counterparty not found")
    buyer = (await db.execute(select(Buyer).where(Buyer.id == counterparty.buyer_id))).scalar_one_or_none()
    if not buyer:
        raise ValueError("Buyer not found for counterparty")
    context = _counterparty_to_context(counterparty, buyer)
    if os.path.exists(TEMPLATE_PATH):
        doc = Document(TEMPLATE_PATH)
    else:
        doc = Document()
        t = doc.add_paragraph()
        h = t.add_run("Договор поставки")
        h.bold = True
        h.font.size = Pt(16)
    _fill_docx_green_markers(doc, context)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    docx_name = f"contract_counterparty_{counterparty_id}_{ts}.docx"
    pdf_name = f"contract_counterparty_{counterparty_id}_{ts}.pdf"
    docx_path = os.path.join(CONTRACTS_DIR, docx_name)
    pdf_path = os.path.join(CONTRACTS_DIR, pdf_name)
    doc.save(docx_path)
    ok = _convert_docx_to_pdf(docx_path, pdf_path)
    if not ok:
        pdf_path = ""
    return docx_path, pdf_path

