import asyncio

from app.db.session import AsyncSessionLocal, create_tables
from app.db.seed_gosts import seed_gosts_and_grades


async def main() -> None:
    await create_tables()
    async with AsyncSessionLocal() as session:
        await seed_gosts_and_grades(session)
    print("Init done")


if __name__ == "__main__":
    asyncio.run(main())


