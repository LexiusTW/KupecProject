import os
from datetime import datetime
from pathlib import Path
from docxtpl import DocxTemplate

CONTRACTS_DIR = "/Users/elr1c180/Desktop/KupecProject/contracts"
DOCX_TEMPLATE_PATH = "/Users/elr1c180/Desktop/KupecProject/docx_template.docx"


def ensure_dir():
    Path(CONTRACTS_DIR).mkdir(exist_ok=True)


def main():
    ensure_dir()
    context = {
        "contract_number": 12345,
        "date": datetime.now().strftime("«%d» %m %Y г."),
        "short_name": "ООО Тест",
        "inn": "7701234567",
        "kpp": "770101001",
        "ogrn": "1234567890123",
        "legal_address": "101000, г. Москва, ул. Тестовая, д.1",
        "bank_name": "ПАО ТЕСТ БАНК",
        "bank_bik": "044525225",
        "bank_account": "40702810123456789012",
        "bank_corr": "30101810400000000225",
        "director": "Иванов И.И.",
        "phone": "+7 (495) 000-00-00",
        "email": "test@example.com",
    }

    if not os.path.exists(DOCX_TEMPLATE_PATH):
        raise SystemExit(f"Template not found: {DOCX_TEMPLATE_PATH}")

    doc = DocxTemplate(DOCX_TEMPLATE_PATH)
    doc.render(context)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = os.path.join(CONTRACTS_DIR, f"contract_test_{ts}.docx")
    doc.save(out_path)
    print(out_path)


if __name__ == "__main__":
    main()


