import asyncio
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal, create_tables
from app.models.counterparty import Counterparty
from app.models.user import User
from app.services.contracts import generate_contract_for_counterparty, ensure_contracts_dir


async def main():
    ensure_contracts_dir()
    await create_tables()
    async with AsyncSessionLocal() as db:  # type: AsyncSession
        cp = (await db.execute(select(Counterparty))).scalars().first()
        if cp is None:
            user = (await db.execute(select(User))).scalars().first()
            if user is None:
                print("Нет пользователей в базе: создайте пользователя или контрагента и повторите")
                return
            cp = Counterparty(
                user_id=user.id,
                short_name="Тест ООО",
                legal_address="г. Москва, ул. Тестовая, д.1",
                ogrn="1234567890123",
                inn="7701234567",
                kpp="770101001",
                okpo="",
                okato="",
                bank_account="40702810900000000001",
                bank_bik="044525225",
                bank_name="ПАО Сбербанк",
                bank_corr="30101810400000000225",
                director="Иванов Иван Иванович",
                phone="+7 900 000-00-00",
                email="test@example.com",
            )
            db.add(cp)
            await db.commit()
            await db.refresh(cp)

        docx_path, pdf_path = await generate_contract_for_counterparty(cp.id, db)
        print("DOCX:", docx_path)
        print("PDF:", pdf_path or "PDF не создан")


if __name__ == "__main__":
    asyncio.run(main())


