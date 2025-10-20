import os
from datetime import datetime
from pathlib import Path
from docxtpl import DocxTemplate

CONTRACTS_DIR = "/Users/elr1c180/Desktop/KupecProject/contracts"
DOCX_TEMPLATE_PATH = "/Users/elr1c180/Desktop/KupecProject/Договор_поставки_ТиО_2020_с_клиентом.docx"
RFQ_TEMPLATE_PATH = "/Users/elr1c180/Desktop/KupecProject/Запрос-КП-от-поставщика.docx"


def ensure_dir():
    Path(CONTRACTS_DIR).mkdir(exist_ok=True)


def build_context():
    now = datetime.now()
    return {
        "contract_number": 9999,
        "date": now.strftime("%d.%m.%Y"),
        "short_name": "Тест ООО",
        "inn": "7701234567",
        "kpp": "770101001",
        "ogrn": "1234567890123",
        "legal_address": "123456, г. Москва, ул. Тестовая, д.1",
        "bank_name": "ПАО Сбербанк",
        "bank_bik": "044525225",
        "bank_account": "40702810900000000001",
        "bank_corr": "30101810400000000225",
        "director": "Иванов И.И.",
        "phone": "+7 (999) 111-22-33",
        "email": "test@example.com",
    }


def render(template_path: str, prefix: str):
    ctx = build_context()
    doc = DocxTemplate(template_path)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    docx_path = os.path.join(CONTRACTS_DIR, f"{prefix}_{ts}.docx")
    doc.render(ctx)
    doc.save(docx_path)
    print(docx_path)


if __name__ == "__main__":
    ensure_dir()
    render(RFQ_TEMPLATE_PATH, "rfq_test")

