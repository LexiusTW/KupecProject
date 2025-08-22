from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base

# Создаем асинхронный движок SQLAlchemy
engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)

# Создаем фабрику сессий
AsyncSessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine, 
    class_=AsyncSession,
    expire_on_commit=False
)

async def create_tables():
    async with engine.begin() as conn:
        # Создаем таблицы, если они не существуют
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
    print("Таблицы успешно созданы (если не существовали).")

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
