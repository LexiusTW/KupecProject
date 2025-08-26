import os
from pathlib import Path
from dotenv import load_dotenv

# Путь к .env файлу в корне проекта
env_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

class Settings:
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    ALGORITHM: str = "HS256"

    # TTL токенов
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", "1440"))

    # Настройки БД
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str = os.getenv("DB_PASS", "postgres")
    DB_SERVER: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: str = os.getenv("DB_PORT", "5432")
    DB_DB: str = os.getenv("DB_NAME", "promtrade_db")

    DATABASE_URL: str = (
        f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_SERVER}:{DB_PORT}/{DB_DB}"
    )

    # Настройки кук для токенов
    COOKIE_DOMAIN: str | None = os.getenv("COOKIE_DOMAIN") or None 
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "lax").lower()
    COOKIE_PATH: str = os.getenv("COOKIE_PATH", "/")

    DADATA_TOKEN: str = os.getenv("DADATA_TOKEN", "")
    DADATA_SECRET: str = os.getenv("DADATA_SECRET", "")
    DADATA_TIMEOUT: float = float(os.getenv("DADATA_TIMEOUT", "2.0"))

settings = Settings()
