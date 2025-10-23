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
    POSTGRES_USER: str = os.getenv("POSTGRES_USER")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD")
    DB_HOST: str = os.getenv("DB_HOST")
    DB_PORT: str = os.getenv("DB_PORT")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB")

    DATABASE_URL: str = (
        f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{DB_HOST}:{DB_PORT}/{POSTGRES_DB}"
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

    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI")

    # Yandex OAuth
    YANDEX_CLIENT_ID: str = os.getenv("YANDEX_CLIENT_ID", "YOUR_YANDEX_ID")
    YANDEX_CLIENT_SECRET: str = os.getenv("YANDEX_CLIENT_SECRET", "YOUR_YANDEX_SECRET")
    YANDEX_REDIRECT_URI: str = os.getenv("YANDEX_REDIRECT_URI")


settings = Settings()