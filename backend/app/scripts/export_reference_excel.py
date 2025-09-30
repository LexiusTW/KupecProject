import os
import re
from pathlib import Path
from typing import List, Tuple, Dict, Set

import pandas as pd


MIGRATIONS_TO_SCAN = [
    "backend/migrations/002_seed_gosts.sql",
    "backend/migrations/003_additional_metal_data.sql",
    "backend/migrations/004_seed_reference_data.sql",
    "backend/migrations/005_comprehensive_metal_database.sql",
]


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def extract_gosts(sql: str) -> List[Tuple[str, str, str]]:
    out: List[Tuple[str, str, str]] = []
    # Находим все блоки INSERT INTO gost (code, name, description) VALUES ...
    pattern_block = re.compile(r"INSERT\s+INTO\s+gost\s*\(\s*code\s*,\s*name\s*,\s*description\s*\)\s*VALUES(.*?);",
                               re.IGNORECASE | re.DOTALL)
    for m in pattern_block.finditer(sql):
        block = m.group(1)
        # Ищем тройки строк в скобках: ('code','name','desc')
        triple_re = re.compile(r"\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)")
        for t in triple_re.finditer(block):
            out.append((t.group(1), t.group(2), t.group(3)))
    return out


def extract_steel_grades(sql: str) -> List[str]:
    out: List[str] = []
    # Блоки вида: INSERT INTO steel_grade (name) VALUES ('A'),('B'),(...)
    pattern_block = re.compile(r"INSERT\s+INTO\s+steel_grade\s*\(\s*name\s*\)\s*VALUES(.*?);",
                               re.IGNORECASE | re.DOTALL)
    for m in pattern_block.finditer(sql):
        block = m.group(1)
        # Вытаскиваем все одиночные 'значения'
        for n in re.findall(r"'([^']+)'", block):
            out.append(n)
    return out


def extract_metals(sql: str) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    # Блоки INSERT INTO metal (...columns...) VALUES (...),(...)
    pattern_block = re.compile(r"INSERT\s+INTO\s+metal\s*\((.*?)\)\s*\n?VALUES(.*?);",
                               re.IGNORECASE | re.DOTALL)
    for m in pattern_block.finditer(sql):
        columns_csv = m.group(1)
        columns = [c.strip() for c in columns_csv.split(',')]
        block = m.group(2)
        # Наивно режем по скобкам верхнего уровня: (...)
        tuple_re = re.compile(r"\(([^()]*?)\)")
        for tup in tuple_re.finditer(block):
            values_part = tup.group(1)
            # Достаём все строковые значения по порядку
            string_vals = re.findall(r"'([^']*)'", values_part)
            # Сопоставим по известным колонкам, вытаскивая только строковые поля
            data: Dict[str, str] = {}
            sv_idx = 0
            for col in columns:
                # Если следующая порция в string_vals предназначена для этой колонки?
                # Переходим по колонкам и подставляем строку, если есть.
                if sv_idx < len(string_vals):
                    data[col] = string_vals[sv_idx]
                    sv_idx += 1
                else:
                    # Остальные (числа/NULL) пропустим
                    pass
            # Сохраним компактно только ключевые текстовые поля
            rows.append({
                'name': data.get('name', ''),
                'state_standard': data.get('state_standard', ''),
                'category': data.get('category', ''),
                'stamp': data.get('stamp', ''),
                'material': data.get('material', ''),
                'unit': data.get('unit', ''),
                'comments': data.get('comments', ''),
            })
    return rows


def main() -> None:
    project_root = Path(__file__).resolve().parents[3]
    combined_sql_parts: List[str] = []
    for rel in MIGRATIONS_TO_SCAN:
        p = project_root / rel
        combined_sql_parts.append(read_text(p))
    combined_sql = "\n\n".join(combined_sql_parts)

    # Извлекаем справочники
    gosts = extract_gosts(combined_sql)
    steel_grades = extract_steel_grades(combined_sql)
    metals = extract_metals(combined_sql)

    # Уникализируем
    gost_seen: Set[str] = set()
    gost_rows: List[Tuple[str, str, str]] = []
    for code, name, desc in gosts:
        if code not in gost_seen:
            gost_seen.add(code)
            gost_rows.append((code, name, desc))

    grade_seen: Set[str] = set()
    grade_rows: List[str] = []
    for g in steel_grades:
        if g not in grade_seen:
            grade_seen.add(g)
            grade_rows.append(g)

    # Формируем Excel
    export_dir = project_root / "excel_outgoing"
    export_dir.mkdir(parents=True, exist_ok=True)
    out_path = export_dir / "reference_catalog.xlsx"

    with pd.ExcelWriter(out_path, engine="openpyxl") as writer:
        pd.DataFrame(gost_rows, columns=["code", "name", "description"]).to_excel(writer, index=False, sheet_name="GOSTs")
        pd.DataFrame(grade_rows, columns=["steel_grade"]).to_excel(writer, index=False, sheet_name="SteelGrades")
        if metals:
            pd.DataFrame(metals).to_excel(writer, index=False, sheet_name="Metal")

    print(f"Готово: {out_path}")


if __name__ == "__main__":
    main()




