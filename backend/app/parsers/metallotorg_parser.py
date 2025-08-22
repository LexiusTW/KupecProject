# app/metallotorg_parser.py
import re
from typing import Any, Dict, List, Optional, Tuple

import pdfplumber

# Регулярное выражение для ГОСТ/ТУ, как в других парсерах
GOST_RE = re.compile(r"((?:ГОСТ|ТУ)\s*[\d.\-]+(?:-[\d]{2,4})?)", re.IGNORECASE)

# Список известных категорий для более точного определения.
# Сортировка по длине важна, чтобы "Лист г/к" проверялся до "Лист".
# Добавлены составные и описательные категории на основе анализа данных.
KNOWN_CATEGORIES = sorted([
    'Арматура гладкая', 'Арматура в прутках', 'Арматура',
    'Балка', 'Катанка в прутках', 'Катанка', 'Квадрат',
    'Круг калиброванный', 'Круг',
    'Лист г/к', 'Лист х/к', 'Лист рифл ЧЕЧЕВИЦА', 'Лист рифл РОМБ', 'Лист рифл',
    'Лист ПВЛ с просечкой', 'Лист ПВЛ', 'Лист оцинкованный', 'Лист',
    'Поковка', 'Полоса оц', 'Полоса',
    'Проволока ВР-1', 'Проволока ОК отож.', 'Проволока ОК', 'Проволока',
    'Профнастил', 'Сетка',
    'Труба БШ', 'Труба ВГП', 'Труба ВГПоц', 'Труба ЭС', 'Труба ЭСоц', 'Труба проф', 'Труба',
    'Уголок', 'Швеллер гнутый', 'Швеллер',
    'Шестигранник калибр', 'Шестигранник'
], key=len, reverse=True)

def capitalize_category(s: Optional[str]) -> Optional[str]:
    """Приводит строку к виду 'Первая заглавная, остальные строчные'."""
    if not s or not isinstance(s, str):
        return s
    return s.strip().capitalize()


def _parse_float(s: Optional[str]) -> Optional[float]:
    """Преобразует строку в float, очищая и заменяя запятую на точку."""
    if not s:
        return None
    s = str(s).replace(",", ".").strip()
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def _parse_price(s: Optional[str]) -> Optional[float]:
    """Извлекает числовое значение цены из строки."""
    if not s:
        return None
    s = str(s).replace(" ", "").replace("\u00a0", "")
    m = re.search(r"(\d+(?:[.,]\d+)?)", s)
    if not m:
        return None
    return float(m.group(1).replace(",", "."))


def _clean_text(s: Optional[str]) -> str:
    """Очищает строку от лишних пробелов и переносов."""
    if not s:
        return ""
    return re.sub(r"\s+", " ", s).strip()


def _parse_name_and_category(name_cell: str) -> Tuple[str, str, Optional[str], Optional[str]]:
    """
    Извлекает из ячейки "Наименование" полное имя, категорию, марку и ГОСТ.
    Логика:
    1. Категория определяется по списку известных категорий в начале строки.
    2. ГОСТ/ТУ/ТС ищутся по регулярному выражению.
    3. Марка - это всё, что осталось после удаления категории и ГОСТов.
    """
    if not name_cell:
        return "", "", None, None

    full_name = _clean_text(name_cell).replace('ё', 'е')

    # 1. Extract Category
    category = None
    details_string = full_name

    for cat in KNOWN_CATEGORIES:
        if full_name.lower().startswith(cat.lower()):
            # Найдена известная категория. Берем ее и остаток строки.
            # Сохраняем регистр из исходной строки.
            category = full_name[:len(cat)]
            details_string = full_name[len(cat):].strip()
            break

    if not category:
        # Fallback: если не нашли категорию в списке, берем первое слово.
        parts = full_name.split(maxsplit=1)
        category = parts[0]
        details_string = parts[1] if len(parts) > 1 else ""

    # 2. Ищем точку раздела между маркой и блоком стандартов
    # Блок стандартов может начинаться с префикса (ГОСТ, ТУ) или с паттерна "число-число"
    gost_block_start_match = re.search(
        r'\b((?:ГОСТ|ТУ|ТС|ОСТ)|(?:\d{2,}-\d{2,}))',
        details_string,
        re.IGNORECASE
    )

    stamp_string = details_string
    gost_string = None

    if gost_block_start_match:
        split_point = gost_block_start_match.start()
        stamp_string = details_string[:split_point].strip()
        gost_string = details_string[split_point:].strip()

    # 3. Очищаем марку и строку ГОСТов от "мусора"
    JUNK_WORDS = [
        'ЗГП', '2ГП', '3ГП', 'гп', 'ГП', 'АША', 'ММК', 'НЛМК', 'ОМЗ', 'УС', 'КТЗ',
        'Алчевск', 'Алч', 'Северсталь', 'СеверСталь', 'Китай', 'Иран',
        'ОГ', 'СА', 'МТ', 'УЗК', 'Д/О', 'Wi', 'сп5', 'р', 'с',
        'в прутках', 'калиброванный', 'отож', 'оц', 'г/к', 'х/к', 'н/лег', 'рифл', 'ПВЛ',
        'с просечкой', 'ЧАСТЬ', 'ПОЛОВИНА', 'Т/О', 'уценка', 'КЛАСС Покрытия 1'
    ]
    # Этот regex удаляет мусорные слова, если перед ними не буква (т.е. начало строки, пробел, цифра, пунктуация)
    junk_re = r'(?<![a-zA-Zа-яА-Я])(' + '|'.join(re.escape(w) for w in JUNK_WORDS) + r')\b'


    # --- Очистка марки ---
    cleaned_stamp = re.sub(junk_re, '', stamp_string, flags=re.IGNORECASE)
    cleaned_stamp = re.sub(r'^[,\-~./\s_()\[\]]+|[,\-~./\s_()\[\]]+$', '', cleaned_stamp)
    cleaned_stamp = re.sub(r'\s{2,}', ' ', cleaned_stamp).strip()
    if cleaned_stamp:
        cleaned_stamp = re.sub(r'\s*/\s*', '/', cleaned_stamp)

    stamp = cleaned_stamp if cleaned_stamp else None

    # --- Очистка ГОСТа ---
    cleaned_gost = gost_string
    if cleaned_gost:
        cleaned_gost = re.sub(junk_re, '', cleaned_gost, flags=re.IGNORECASE)
        cleaned_gost = re.sub(r'^[,\-~./\s_()\[\]]+|[,\-~./\s_()\[\]]+$', '', cleaned_gost)
        cleaned_gost = re.sub(r'\s{2,}', ' ', cleaned_gost).strip()

    gost = cleaned_gost if cleaned_gost else None

    # 4. Пост-обработка для особых случаев
    # Если марка не содержит букв (напр. "100*100" для сетки), считаем ее частью категории
    if stamp and not re.search(r'[a-zA-Zа-яА-Я]', stamp):
        category = f"{category} {stamp}".strip()
        stamp = None

    return full_name, capitalize_category(category), stamp, gost


def _parse_dimensions(size_cell: str, len_cell: str, category: Optional[str]) -> Dict[str, Any]:
    """Извлекает размеры из соответствующих колонок."""
    d: Dict[str, Any] = {"diameter": None, "thickness": None, "width": None, "length": None, "comments": []}

    size_cell = _clean_text(size_cell)
    len_cell = _clean_text(len_cell)

    # --- Обработка колонки "Размер" ---
    if size_cell:
        if "*" in size_cell or "х" in size_cell:
            d["comments"].append(f"Размер: {size_cell}")
        else:
            val = _parse_float(size_cell)
            if val:
                # Эвристика для определения, диаметр это или толщина
                is_round = category and any(k in category.lower() for k in ["круг", "труба", "проволока", "катанка", "арматура"])
                if is_round:
                    d["diameter"] = val
                else:
                    d["thickness"] = val

    # --- Обработка колонки "Длина" ---
    if len_cell:
        len_cell_lower = len_cell.lower()
        if any(keyword in len_cell_lower for keyword in ["бухта", "гп", "-", "—", "н/д", "нд"]):
            d["length"] = None
        elif "*" in len_cell or "х" in len_cell:
            dims = re.findall(r"(\d+(?:[.,]\d+)?)", len_cell)
            if len(dims) >= 2:
                w = _parse_float(dims[0])
                l = _parse_float(dims[1])
                d["width"] = w / 1000 if w and w > 100 else w
                d["length"] = l / 1000 if l and l > 100 else l
            else:
                d["comments"].append(f"Длина: {len_cell}")
        elif "м+нд" in len_cell_lower:
            m = re.match(r"(\d+(?:[.,]\d+)?)", len_cell)
            if m:
                d["length"] = _parse_float(m.group(1))
        else:
            cleaned_len = re.sub(r'[^\d,.]', '', len_cell)
            length_val = _parse_float(cleaned_len)
            if length_val:
                d["length"] = length_val
            elif len_cell.strip():
                d["comments"].append(f"Длина: {len_cell}")

    d["comments"] = "; ".join(d["comments"]) if d["comments"] else None
    return d


def parse_metallotorg_pdf(file_path: str) -> List[Dict[str, Any]]:
    """Основная функция для парсинга PDF-файла от Металлоторга."""
    products = []
    try:
        with pdfplumber.open(file_path) as pdf:
            header = None
            name_idx, size_idx, len_idx, price_idx = -1, -1, -1, -1

            # 1. Найти заголовок на первой подходящей странице
            for page in pdf.pages:
                table = page.extract_table()
                if not table:
                    continue

                header_row_index = -1
                for i, row in enumerate(table):
                    if row and row[0] and "Наименование" in row[0]:
                        header = [_clean_text(cell) for cell in row]
                        header_row_index = i
                        break
                
                if header:
                    try:
                        name_idx = header.index("Наименование")
                        size_idx = header.index("Размер")
                        len_idx = header.index("Длина")
                        price_idx = next(i for i, col in enumerate(header) if "Цена" in col and "1-5" in col)
                        break
                    except (ValueError, StopIteration):
                        header = None
                        continue
            
            if not header:
                print(f"Не удалось найти заголовок таблицы в файле {file_path}")
                return []

            # 2. Обработать все страницы, используя найденный заголовок
            for page in pdf.pages:
                table = page.extract_table()
                if not table:
                    continue

                start_row = 0
                for i, row in enumerate(table):
                    if row and row[0] and "Наименование" in row[0]:
                        start_row = i + 1
                        break

                for row_data in table[start_row:]:
                    if not row_data or len(row_data) <= max(name_idx, size_idx, len_idx, price_idx):
                        continue

                    name_cell = row_data[name_idx]
                    if not name_cell or "---" in name_cell:
                        continue

                    full_name, category, stamp, gost = _parse_name_and_category(name_cell)
                    dims = _parse_dimensions(row_data[size_idx], row_data[len_idx], category)

                    product = {
                        "name": full_name, "category": category, "stamp": stamp, "state_standard": gost,
                        "price": _parse_price(row_data[price_idx]), "unit": "т",
                        **dims
                    }
                    products.append(product)
    except Exception as e:
        print(f"Ошибка при обработке PDF файла {file_path}: {e}")

    return products