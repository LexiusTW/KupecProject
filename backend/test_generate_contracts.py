import asyncio
from datetime import datetime

from app.db.session import AsyncSessionLocal
from app.models.counterparty import Counterparty
from app.services.contracts import generate_contract_for_counterparty, generate_supplier_rfq_for_counterparty, ensure_contracts_dir


async def main():
    ensure_contracts_dir()
    async with AsyncSessionLocal() as db:
        c = Counterparty(
            buyer_id=1,
            short_name="Тест ООО",
            legal_address="123456, г. Москва, ул. Тестовая, д.1",
            ogrn="1234567890123",
            inn="7701234567",
            kpp="770101001",
            okpo="12345678",
            okato="45286585000",
            bank_account="40702810900000000001",
            bank_bik="044525225",
            bank_name="ПАО Сбербанк",
            bank_corr="30101810400000000225",
        )
        db.add(c)
        await db.commit()
        await db.refresh(c)

        docx_contract, pdf_contract = await generate_contract_for_counterparty(c.id, db)
        docx_rfq, pdf_rfq = await generate_supplier_rfq_for_counterparty(c.id, db)

        print("CONTRACT DOCX:", docx_contract)
        print("CONTRACT PDF:", pdf_contract)
        print("RFQ DOCX:", docx_rfq)
        print("RFQ PDF:", pdf_rfq)


if __name__ == "__main__":
    asyncio.run(main())

