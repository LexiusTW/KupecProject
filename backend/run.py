import copy
import os
import sys
import logging
import uvicorn
import psycopg2
from uvicorn.config import LOGGING_CONFIG

from app.core.config import settings

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "migrations")

# обязательные таблицы для старта приложения
REQUIRED_TABLES = {
    "buyers", "sellers",
    "metal", "metal_green",
    "warehouse", "warehouse_green",
    "requests", "request_items",
    "gost", "steel_grade", "gost_grade",
    "chats", "chat_participants", "chat_messages", "emails",
}

def get_conn():
    dsn = (
        f"dbname='{settings.DB_DB}' "
        f"user='{settings.DB_USER}' "
        f"password='{settings.DB_PASSWORD}' "
        f"host='{settings.DB_SERVER}' "
        f"port='{settings.DB_PORT}'"
    )
    return psycopg2.connect(dsn)

def get_existing_tables() -> set[str]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT tablename
                FROM pg_catalog.pg_tables
                WHERE schemaname = 'public'
            """)
            return {row[0] for row in cur.fetchall()}

def _table_count(cur, table: str) -> int:
    cur.execute(f"SELECT COUNT(*) FROM {table}")
    return int(cur.fetchone()[0])

def _should_skip_seed(cur, filename: str) -> bool:
    """
    Грубая эвристика: если файл - сид (по имени), и целевые таблицы уже НЕ пустые,
    то пропускаем его, чтобы избежать дублей.
    Добавляйте сюда правила под свои сиды.
    """
    name = filename.lower()
    if "seed" not in name:
        return False

    # пример: сид ГОСТов
    if "gost" in name:
        try:
            return (_table_count(cur, "gost") > 0) or (_table_count(cur, "steel_grade") > 0)
        except psycopg2.Error:
            # если таблиц пока нет — не пропускаем сид
            return False

    # общий случай: по умолчанию не пропускаем (или верните True, если хотите полностью глушить любые seed)
    return False

def run_sql_file(cur, path: str):
    with open(path, "r", encoding="utf-8") as f:
        sql = f.read()
    cur.execute(sql)

def apply_migrations_if_needed(missing_tables: set[str]):
    """
    Запускаем миграции ТОЛЬКО если есть отсутствующие таблицы.
    При этом сид-скрипты (по имени) пропускаем, если их целевые таблицы уже непустые.
    """
    if not missing_tables:
        logging.info("Все обязательные таблицы уже существуют — миграции пропущены.")
        return

    if not os.path.isdir(MIGRATIONS_DIR):
        logging.error("Папка с миграциями не найдена: %s", MIGRATIONS_DIR)
        sys.exit(1)

    files = sorted(f for f in os.listdir(MIGRATIONS_DIR) if f.endswith(".sql"))
    if not files:
        logging.error("В %s нет .sql файлов миграций.", MIGRATIONS_DIR)
        sys.exit(1)

    logging.info("Отсутствуют таблицы: %s", ", ".join(sorted(missing_tables)))
    logging.info("Применяю миграции из %s…", MIGRATIONS_DIR)

    with get_conn() as conn:
        with conn.cursor() as cur:
            for fname in files:
                path = os.path.join(MIGRATIONS_DIR, fname)
                # при необходимости пропустим сид-файл
                if _should_skip_seed(cur, fname):
                    logging.info("Пропускаю сид-миграцию (таблицы уже заполнены): %s", fname)
                    continue
                logging.info("Миграция: %s", fname)
                run_sql_file(cur, path)
            conn.commit()

    # финальная сверка
    existing_after = get_existing_tables()
    still_missing = REQUIRED_TABLES - existing_after
    if still_missing:
        logging.error("После миграций отсутствуют таблицы: %s", ", ".join(sorted(still_missing)))
        sys.exit(1)

    logging.info("Миграции успешно применены, все обязательные таблицы присутствуют.")

def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    # 1) Сначала проверяем наличие таблиц
    existing = get_existing_tables()
    missing = REQUIRED_TABLES - existing

    # 2) Если чего-то не хватает — только тогда запускаем миграции
    apply_migrations_if_needed(missing)

    config = copy.deepcopy(LOGGING_CONFIG)
    config["formatters"]["default"]["fmt"] = "%(asctime)s %(levelname)s %(message)s"
    config["formatters"]["default"]["datefmt"] = "%Y-%m-%d %H:%M:%S"
    config["formatters"]["access"]["fmt"] = '%(asctime)s %(levelname)s %(client_addr)s - "%(request_line)s" %(status_code)s'
    config["formatters"]["access"]["datefmt"] = "%Y-%m-%d %H:%M:%S"
    
    # 3) Стартуем API
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True, log_config=config)
    

if __name__ == "__main__":
    main()
