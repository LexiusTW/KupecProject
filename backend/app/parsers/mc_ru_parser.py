# app/mc_ru_parser.py
import asyncio
import re
from typing import Dict, List, Optional, Tuple
from bs4 import BeautifulSoup
from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError

# Простейший маппинг из русских заголовков в наши поля
# Всё, чего нет — складываем в comment
# Колонки на сайтах МС бывают в разных регистрах/вариантах — нормализуем по lower()
COL_MAP = {
    "марка": "stamp",
    "бренд": "stamp",  # на всякий случай
    "профиль": "name",  # иногда вместо «марка» или как заголовок строки
    "наименование": "name",

    "гост": "state_standard",  # если есть отдельная колонка ГОСТ

    "диаметр": "diameter",
    "d, диаметр": "diameter",
    "толщина": "thickness",
    "ширина": "width",
    "высота": "height",     # если вдруг встречается — можно конвертить в comments/width при надобности
    "длина": "length",
    "материал": "material",

    "ед.изм": "unit",
    "ед. изм.": "unit",
    "единица": "unit",

    "цена": "price",
    "цена, руб": "price",
    "цена, руб.": "price",
    "цена, ₽": "price",
}


GOST_RE = re.compile(r"((?:ГОСТ|ТУ)\s*[\d.\-]+(?:-[\d]{2,4})?)", re.IGNORECASE)

def capitalize_category(s: Optional[str]) -> Optional[str]:
    """Приводит строку к виду 'Первая заглавная, остальные строчные'."""
    if not s or not isinstance(s, str):
        return s
    return s.strip().capitalize()


def _clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _parse_dimension(s: Optional[str]) -> Optional[float]:
    if not s:
        return None
    s = s.replace(",", ".").strip()
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def _parse_price(s: str) -> Optional[float]:
    s = s.replace(" ", "").replace("\u00a0", "")
    m = re.search(r"(\d+(?:[.,]\d+)?)", s)
    if not m:
        return None
    return float(m.group(1).replace(",", "."))


def _split_diameters(s: str) -> List[str]:
    # пример: "14 ; 18; 20; 22; 25" -> ["14","18","20","22","25"]
    parts = re.split(r"[;,/]|(?:\s+\u2022\s+)", s)
    return [p.strip() for p in parts if p.strip()]


async def process_mc_page_with_page(page: Page, url: str, category_hint: Optional[str] = None) -> Tuple[List[dict], Optional[Dict[str, str]]]:
    """
    Загружает страницу Металлсервиса в переданный Playwright Page, парсит <tbody> с прайсом.
    Возвращает список products и (пока) None для контактов.
    """
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Используем 'domcontentloaded', т.к. таблицы статичны. Это быстрее и надежнее.
            response = await page.goto(url, wait_until="domcontentloaded", timeout=5_000)
            break  # Успех, выходим из цикла
        except PlaywrightTimeoutError as e:
            print(f"  - Таймаут при загрузке {url} (попытка {attempt + 1}/{max_retries}). Повторяю...")
            if attempt + 1 == max_retries:
                raise e  # Если все попытки провалились, пробрасываем исключение
            await asyncio.sleep(5 * (attempt + 1))  # Ожидание перед повторной попыткой

    if not response:
        raise PlaywrightTimeoutError(f"Failed to get a response from {url} after {max_retries} retries.")

    # Сайт mc.ru может отдавать контент в UTF-8, но с неверным meta-тегом charset=windows-1251.
    # Чтобы избежать проблем с кодировкой, читаем сырые байты и принудительно декодируем как UTF-8.
    body = await response.body()
    html = body.decode('utf-8', errors='replace')
    soup = BeautifulSoup(html, "lxml")

    # Категория — из <th colspan> или из заголовка блока, можно взять первый <th colspan> в таблице
    products: List[dict] = []
    contacts: Optional[Dict[str, str]] = None

    # На страницах МС часто много секций таблиц. Берём все <table> и ищем в них thead/tbody.
    for tbl in soup.find_all("table"):
        thead = tbl.find("thead")
        tbody = tbl.find("tbody")
        if not tbody:
            continue

        # Заголовок категории — ближайший предыдущий <tr><th colspan>
        category = None
        # иногда в tbody первой строкой идёт <tr><th colspan=...>НАЗВАНИЕ</th></tr>
        first_row = tbody.find("tr")
        if first_row:
            ths = first_row.find_all("th")
            if len(ths) == 1:
                category = _clean_text(ths[0].get_text(" "))
        if not category:
            # Фолбэк: из параметра вызова
            category = category_hint
        
        # Приводим категорию к единому виду
        capitalized_category = capitalize_category(category)

        # Построим карту колонок
        headers = []
        if thead:
            for th in thead.find_all("th"):
                headers.append(_clean_text(th.get_text(" ")))
        else:
            # Иногда заголовок таблицы хранится во второй строке tbody (первая — название категории)
            rows = tbody.find_all("tr")
            if len(rows) > 1 and rows[1].find_all("th"):
                headers = [_clean_text(th.get_text(" ")) for th in rows[1].find_all("th")]
            elif len(rows) > 0 and rows[0].find_all("th"):
                headers = [_clean_text(th.get_text(" ")) for th in rows[0].find_all("th")]

        if not headers:
            continue

        # Индексы полезных колонок
        cols_norm = [h.lower() for h in headers]

        # Перебираем строки данных
        for tr in tbody.find_all("tr"):
            # пропустим строки, где только TH (заголовок/категория)
            if tr.find("th") and not tr.find("td"):
                continue

            tds = tr.find_all("td")
            if not tds:
                continue

            row: dict = {
                "category": capitalized_category,
                "name": None,
                "stamp": None,
                "diameter": None,
                "thickness": None,
                "width": None,
                "length": None,
                "material": None,
                "unit": None,
                "price": None,
                "comments": None,
                "state_standard": None,
            }

            extras: Dict[str, str] = {}

            for idx, td in enumerate(tds):
                val = _clean_text(td.get_text(" "))
                hdr = cols_norm[idx] if idx < len(cols_norm) else f"col{idx}"
                key = COL_MAP.get(hdr, None)

                if key == "price":
                    row["price"] = _parse_price(val)
                elif key == "diameter":
                    row["diameter"] = val
                elif key in {"thickness", "width", "length"}:
                    row[key] = _parse_dimension(val)
                elif key in {"stamp", "name", "unit", "material", "state_standard"}:
                    row[key] = val
                else:
                    if val:
                        extras[headers[idx] if idx < len(headers) else f"col{idx}"] = val

            # Если в строке нет явного наименования, используем категорию (название таблицы) как имя
            if not row["name"]:
                row["name"] = capitalized_category

            # Ищем ГОСТ/ТУ в наименовании, переносим в отдельное поле и очищаем наименование
            if row.get("name") and isinstance(row["name"], str):
                match = GOST_RE.search(row["name"])
                if match:
                    gost_or_tu = match.group(1).strip()
                    if not row.get("state_standard"):
                        row["state_standard"] = gost_or_tu
                    row["name"] = GOST_RE.sub("", row["name"]).strip()

            # Склей комментарий
            if extras:
                row["comments"] = "; ".join(f"{k}: {v}" for k, v in extras.items())

            # Если в ячейке диаметров было несколько значений — разнесём
            diams = _split_diameters(row["diameter"]) if row.get("diameter") else [None]
            for d in diams:
                new_row = dict(row)
                new_row["diameter"] = _parse_dimension(d)
                products.append(new_row)

    return products, contacts
