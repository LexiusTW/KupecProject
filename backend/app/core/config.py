import os
from pathlib import Path
from dotenv import load_dotenv

# Путь к .env файлу в корне проекта
env_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

class Settings:
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    ALGORITHM: str = "HS256"

    # TTL токенов
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
    REFRESH_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES"))

    # Настройки БД
    DB_USER: str = os.getenv("DB_USER")
    DB_PASSWORD: str = os.getenv("DB_PASS")
    DB_SERVER: str = os.getenv("DB_HOST")
    DB_PORT: str = os.getenv("DB_PORT")
    DB_DB: str = os.getenv("DB_NAME")

    DATABASE_URL: str = (
        f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_SERVER}:{DB_PORT}/{DB_DB}"
    )

    # Настройки кук для токенов
    COOKIE_DOMAIN: str | None = os.getenv("COOKIE_DOMAIN") or None
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "lax").lower()
    COOKIE_PATH: str = os.getenv("COOKIE_PATH", "/")

    # URL фронтенда для генерации ссылок в письмах
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

    DADATA_TOKEN: str = os.getenv("DADATA_TOKEN", "")
    DADATA_SECRET: str = os.getenv("DADATA_SECRET", "")
    DADATA_TIMEOUT: float = float(os.getenv("DADATA_TIMEOUT", "2.0"))

    # Настройки SMTP
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.mail.ru")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", 465))
    SMTP_USER: str = os.getenv("SMTP_USER")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME")

    # Директории для загрузок
    INVOICES_DIR: str = "invoices"
    SUPPLIER_CONTRACTS_DIR: str = "contracts"


settings = Settings()