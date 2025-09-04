import os
import psycopg2
from psycopg2.extras import execute_batch

from app.core.config import settings


def get_conn():
    dsn = f"dbname='{settings.DB_DB}' user='{settings.DB_USER}' password='{settings.DB_PASSWORD}' host='{settings.DB_SERVER}' port='{settings.DB_PORT}'"
    return psycopg2.connect(dsn)


def run_sql_file(cursor, path: str):
    with open(path, 'r', encoding='utf-8') as f:
        sql = f.read()
    cursor.execute(sql)


def main():
    base_dir = os.path.join(os.path.dirname(__file__), 'migrations')
    files = sorted([f for f in os.listdir(base_dir) if f.endswith('.sql')])
    with get_conn() as conn:
        with conn.cursor() as cur:
            for fname in files:
                path = os.path.join(base_dir, fname)
                run_sql_file(cur, path)
            conn.commit()
    print('Migrations applied')


if __name__ == '__main__':
    main()


