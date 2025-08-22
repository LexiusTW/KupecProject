# app/run.py
import asyncio
import os
import sys
from typing import Dict, List, Optional
from datetime import datetime, timezone
import aiofiles
import httpx
from playwright.async_api import async_playwright
from sqlalchemy import delete, select

from app.db.session import create_tables, AsyncSessionLocal
from app.parsers.excel_processor import process_excel_file
from app.parsers.mc_ru_parser import process_mc_page_with_page
from app.parsers.metallotorg_parser import parse_metallotorg_pdf
from app.models.metal import Metal, MetalGreen
from app.models.warehouse import Warehouse, WarehouseGreen
from app.parsers.parser import download_pricelist, select_moscow_if_needed

EVRAZ_SUPPLIER = "ЕВРАЗ"
MC_SUPPLIER = "Металлсервис"

# ====== EVRAZ ======
CITIES = {
    "msk": "https://evraz.market/pricelist/?city=103",
    "barnaul": "https://barnaul.evraz.market/pricelist/",
    "belgorod": "https://belgorod.evraz.market/pricelist/",
    "biisk": "https://biisk.evraz.market/pricelist/", 
    "bryansk": "https://bryansk.evraz.market/pricelist/",
    "vladivostok": "https://vladivostok.evraz.market/pricelist/", 
    "vladimir": "https://vladimir.evraz.market/pricelist/",
    "volgograd": "https://volgograd.evraz.market/pricelist/", 
    "vrn": "https://vrn.evraz.market/pricelist/",
    "ekb": "https://ekb.evraz.market/pricelist/", 
    "irk": "https://irk.evraz.market/pricelist/",
    "kzn": "https://kzn.evraz.market/pricelist/", 
    "kirov": "https://kirov.evraz.market/pricelist/",
    "krasnodar": "https://krasnodar.evraz.market/pricelist/", 
    "krsk": "https://krsk.evraz.market/pricelist/",
    "lipetsk": "https://lipetsk.evraz.market/pricelist/", 
    "magnitogorsk": "https://magnitogorsk.evraz.market/pricelist/",
    "minvody": "https://minvody.evraz.market/pricelist/", 
    "chelny": "https://chelny.evraz.market/pricelist/",
    "nn": "https://nn.evraz.market/pricelist/", 
    "nizhniy-tagil": "https://nizhniy-tagil.evraz.market/pricelist/",
    "novokuznetsk": "https://novokuznetsk.evraz.market/pricelist/", 
    "nsk": "https://nsk.evraz.market/pricelist/",
    "omsk": "https://omsk.evraz.market/pricelist/", 
    "ornb": "https://ornb.evraz.market/pricelist/",
    "penza": "https://penza.evraz.market/pricelist/", 
    "prm": "https://prm.evraz.market/pricelist/",
    "rostov": "https://rostov.evraz.market/pricelist/", 
    "sam": "https://sam.evraz.market/pricelist/",
    "spb": "https://spb.evraz.market/pricelist/", 
    "saransk": "https://saransk.evraz.market/pricelist/",
    "saratov": "https://saratov.evraz.market/pricelist/", 
    "sochi": "https://sochi.evraz.market/pricelist/",
    "oskol": "https://oskol.evraz.market/pricelist/", 
    "taganrog": "https://taganrog.evraz.market/pricelist/",
    "tula": "https://tula.evraz.market/pricelist/", 
    "ulianovsk": "https://ulianovsk.evraz.market/pricelist/",
    "ufa": "https://ufa.evraz.market/pricelist/", 
    "khabarovsk": "https://khabarovsk.evraz.market/pricelist/",
    "chel": "https://chel.evraz.market/pricelist/", 
    "chita": "https://chita.evraz.market/pricelist/",
    "sakhalinsk": "https://sakhalinsk.evraz.market/pricelist/",
}

CITY_CODES_TO_RUSSIAN = {
    "msk": "Москва",
    "barnaul": "Барнаул",
    "belgorod": "Белгород",
    "biisk": "Бийск",
    "bryansk": "Брянск",
    "vladivostok": "Владивосток",
    "vladimir": "Владимир",
    "volgograd": "Волгоград",
    "vrn": "Воронеж",
    "ekb": "Екатеринбург",
    "irk": "Иркутск",
    "kzn": "Казань",
    "kirov": "Киров",
    "krasnodar": "Краснодар",
    "krsk": "Красноярск",
    "lipetsk": "Липецк",
    "magnitogorsk": "Магнитогорск",
    "minvody": "Минеральные Воды",
    "chelny": "Набережные Челны",
    "nn": "Нижний Новгород",
    "nizhniy-tagil": "Нижний Тагил",
    "novokuznetsk": "Новокузнецк",
    "nsk": "Новосибирск",
    "omsk": "Омск",
    "ornb": "Оренбург",
    "penza": "Пенза",
    "prm": "Пермь",
    "rostov": "Ростов-на-Дону",
    "sam": "Самара",
    "spb": "Санкт-Петербург",
    "saransk": "Саранск",
    "saratov": "Саратов",
    "sochi": "Сочи",
    "oskol": "Старый Оскол",
    "taganrog": "Таганрог",
    "tula": "Тула",
    "ulianovsk": "Ульяновск",
    "ufa": "Уфа",
    "khabarovsk": "Хабаровск",
    "chel": "Челябинск",
    "chita": "Чита",
    "sakhalinsk": "Южно-Сахалинск",
}

MC_LINKS_BY_CITY: dict[str, list[str]] = {
    #Москва и область (основные разделы MC + локальные страницы)
    "Москва": [
        "https://mc.ru/prices/kachestvst.htm?v=2",
        "https://mc.ru/prices/sortovojprokat.htm?v=2",
        "https://mc.ru/prices/listovojprokat.htm?v=2",
        "https://mc.ru/prices/truby.htm?v=2",
        "https://mc.ru/prices/metizy.htm?v=2",
        "https://mc.ru/prices/cvetmet.htm?v=2",
        "https://mc.ru/prices/engineering.htm?v=2",
        "https://mc.ru/prices/krepezh.htm?v=2",
        "https://mc.ru/prices/list_nerzh_sht.htm?v=2",
        "https://mc.ru/prices/nerzhaveika.htm?v=2",
        "https://mc.ru/prices/price_gaz.htm?v=2",
        "https://mc.ru/prices/profnastil.htm?v=2",
        "https://mc.ru/prices/price_noginsk.htm?v=2",
        "https://mc.ru/prices/price_balash.htm?v=2",
    ],

    "Санкт-Петербург": [
        "https://mc.ru/prices/filials/price_piter_ch.htm",
        "https://mc.ru/prices/filials/price_piter_cvet.htm",
    ],

    "Нижний Новгород": [
        "https://mc.ru/prices/filials/price_nnovgorod.htm",
        "https://mc.ru/prices/filials/profnastil_nnovgorod.htm",
        "https://mc.ru/prices/filials/price_nnovgorod_konovalova.htm",
    ],

    "Балаково": ["https://mc.ru/prices/filials/price_balakovo.htm"],
    "Пенза": ["https://mc.ru/prices/filials/price_penza.htm"],
    "Самара": ["https://mc.ru/prices/filials/price_samara.htm"],

    "Чебоксары": [
        "https://mc.ru/prices/filials/price_cheboksary.htm",
        "https://mc.ru/prices/filials/price_cheboksary1.htm",
    ],

    "Брянск": ["https://mc.ru/prices/filials/price_br.htm"],
    "Курск": ["https://mc.ru/prices/filials/price_kursk.htm"],
    "Белгород": ["https://mc.ru/prices/filials/price_belgorod.htm"],
    "Краснодар": ["https://mc.ru/prices/filials/price_krasnodar.htm"],
    "Таганрог": ["https://mc.ru/prices/filials/price_taganrog.htm"],
    "Юг": ["https://mc.ru/prices/filials/price_ug.htm"],

    "Екатеринбург": [
        "https://mc.ru/prices/filials/price_ekaterinburg.htm",
        "https://mc.ru/prices/filials/price_ekat_prof.htm",
    ],
    "Пермь": ["https://mc.ru/prices/filials/price_perm.htm"],
    "Челябинск": [
        "https://mc.ru/prices/filials/price_chelyabinsk_pr.htm",
        "https://mc.ru/prices/filials/price_chelyabinsk_prof.htm",
    ],

    "Кемерово": ["https://mc.ru/prices/filials/price_kemerovo.htm"],
    "Барнаул": ["https://mc.ru/prices/filials/price_barnaul.htm"],
    "Омск": ["https://mc.ru/prices/filials/price_omsk.htm"],
    "Красноярск": ["https://mc.ru/prices/filials/price_krasnoyarsk.htm"],
    "Сибирь": ["https://mc.ru/prices/filials/price_sib.htm"],

    "Хабаровск": ["https://mc.ru/prices/filials/price_hab.htm"],
}

METALLOTORG_SUPPLIER = "Металлоторг"

METALLOTORG_LINKS_BY_CITY: dict[str, str] = {
    "Белгород": "https://metallotorg.su/images/price/pdf/price-metall-belgorod-kreida.pdf",
    "Брянск": "https://metallotorg.su/images/price/pdf/price-metall-bryansk.pdf",
    "Владикавказ": "https://metallotorg.su/images/price/pdf/price-metall-vladikavkaz.pdf",
    "Владимир": "https://metallotorg.su/images/price/pdf/price-metall-vladimir.pdf",
    "Волгоград": "https://metallotorg.su/images/price/pdf/price-metall-volgograd.pdf",
    "Воронеж": "https://metallotorg.su/images/price/pdf/price-metall-voronezh.pdf",
    "Екатеринбург": "https://metallotorg.su/images/price/pdf/price-metall-ekaterinburg.pdf",
    "Ижевск": "https://metallotorg.su/images/price/pdf/price-metall-izhevsk.pdf",
    "Казань": "https://metallotorg.su/images/price/pdf/price-metall-kazan.pdf",
    "Калуга": "https://metallotorg.su/images/price/pdf/price-metall-kaluga.pdf",
    "Кемерово": "https://metallotorg.su/images/price/pdf/price-metall-kemerovo.pdf",
    "Киров": "https://metallotorg.su/images/price/pdf/price-metall-kirov.pdf",
    "Краснодар": "https://metallotorg.su/images/price/pdf/price-metall-titarovka.pdf",
    "Курск": "https://metallotorg.su/images/price/pdf/price-metall-kursk.pdf",
    "Липецк": "https://metallotorg.su/images/price/pdf/price-metall-lipeck.pdf",
    "Лобня": "https://metallotorg.su/images/price/pdf/price-metall-lobnya.pdf",
    "Махачкала": "https://metallotorg.su/images/price/pdf/price-metall-mahachkala.pdf",
    "Набережные Челны": "https://metallotorg.su/images/price/pdf/price-metall-chelny.pdf",
    "Нальчик": "https://metallotorg.su/images/price/pdf/price-metall-nalchik.pdf",
    "Нижний Новгород": "https://metallotorg.su/images/price/pdf/price-metall-niznij-novgorod.pdf",
    "Новокузнецк": "https://metallotorg.su/images/price/pdf/price-metall-novokuzneck.pdf",
    "Новосибирск": "https://metallotorg.su/images/price/pdf/price-metall-novosibirsk.pdf",
    "Новочеркасск": "https://metallotorg.su/images/price/pdf/price-metall-novocherkassk.pdf",
    "Орел": "https://metallotorg.su/images/price/pdf/price-metall-orel.pdf",
    "Оренбург": "https://metallotorg.su/images/price/pdf/price-metall-orenburg.pdf",
    "Пенза": "https://metallotorg.su/images/price/pdf/price-metall-penza.pdf",
    "Пермь": "https://metallotorg.su/images/price/pdf/price-metall-perm.pdf",
    "Пятигорск": "https://metallotorg.su/images/price/pdf/price-metall-pyatigorsk.pdf",
    "Ростов-на-Дону": "https://metallotorg.su/images/price/pdf/price-metall-rostov.pdf",
    "Рязань": "https://metallotorg.su/images/price/pdf/price-metall-ryazan.pdf",
    "Самара": "https://metallotorg.su/images/price/pdf/price-metall-samara.pdf",
    "Санкт-Петербург": "https://metallotorg.su/images/price/pdf/price-metall-fornosovo-peterburg.pdf",
    "Саранск": "https://metallotorg.su/images/price/pdf/price-metall-saransk.pdf",
    "Саратов": "https://metallotorg.su/images/price/pdf/price-metall-saratov.pdf",
    "Ставрополь": "https://metallotorg.su/images/price/pdf/price-metall-stavropol.pdf",
    "Старый Оскол": "https://metallotorg.su/images/price/pdf/price-metall-staryi-oskol.pdf",
    "Сызрань": "https://metallotorg.su/images/price/pdf/price-metall-syzran.pdf",
    "Тверь": "https://metallotorg.su/images/price/pdf/price-metall-tver.pdf",
    "Тула": "https://metallotorg.su/images/price/pdf/price-metall-tula-plehanovo.pdf",
    "Тюмень": "https://metallotorg.su/images/price/pdf/price-metall-tumen.pdf",
    "Ульяновск": "https://metallotorg.su/images/price/pdf/price-metall-ulyanovsk.pdf",
    "Уфа": "https://metallotorg.su/images/price/pdf/price-metall-ufa.pdf",
    "Чебоксары": "https://metallotorg.su/images/price/pdf/price-metall-cheboksary.pdf",
    "Челябинск": "https://metallotorg.su/images/price/pdf/price-metall-chelyabinsk.pdf",
    "Череповец": "https://metallotorg.su/images/price/pdf/price-metall-cherepovec.pdf",
    "Чехов": "https://metallotorg.su/images/price/pdf/price-metall-chekhov.pdf",
    "Электроугли": "https://metallotorg.su/images/price/pdf/price-metall-electrougli.pdf",
    "Ярославль": "https://metallotorg.su/images/price/pdf/price-metall-yaroslavl.pdf",
}



async def finalize_green_to_blue(session, *, supplier: str, city: str) -> None:
    """
    Переносим данные из green -> blue по указанному поставщику и городу.
    1) Берём WarehouseGreen (supplier, city)
    2) Находим/создаём Warehouse (blue) по city 
    3) Переносим все MetalGreen -> Metal, проставляя warehouse_id синих таблиц
    4) Очищаем green-таблицы по этому городу/поставщику
    """
    wg = await session.scalar(
        select(WarehouseGreen).where(
            WarehouseGreen.city == city,
            WarehouseGreen.supplier == supplier
        )
    )

    # Если зелёного склада нет — просто очистим его возможные остатки металла и выйдем
    if not wg:
        # На всякий случай подчистим «зелёный» металл без склада для этого города/поставщика
        await session.execute(
            delete(MetalGreen).where(
                MetalGreen.warehouse_id.in_(
                    select(WarehouseGreen.id)
                    .where(WarehouseGreen.city == city, WarehouseGreen.supplier == supplier)
                )
            )
        )
        await session.execute(
            delete(WarehouseGreen).where(
                WarehouseGreen.city == city, WarehouseGreen.supplier == supplier
            )
        )
        await session.commit()
        return

    # Апсертим склад в синих таблицах. Ищем по паре (город, поставщик).
    wb = await session.scalar(
        select(Warehouse).where(
            Warehouse.city == city,
            Warehouse.supplier == supplier
        )
    )
    if wb is None:
        wb = Warehouse(
            city=wg.city,
            supplier=wg.supplier,
            phone_number=wg.phone_number,
            email=wg.email,
            legal_entity=wg.legal_entity,
            working_hours=wg.working_hours,
        )
        session.add(wb)
        await session.flush()
    else:
        wb.supplier = wg.supplier
        wb.phone_number = wg.phone_number
        wb.email = wg.email
        wb.legal_entity = wg.legal_entity
        wb.working_hours = wg.working_hours
        await session.flush()

    # Переносим металл
    mg_rows = (await session.scalars(
        select(MetalGreen).where(MetalGreen.warehouse_id == wg.id)
    )).all()

    await session.execute(delete(Metal).where(Metal.warehouse_id == wb.id))

    to_insert = []
    for m in mg_rows:
        to_insert.append(Metal(
            name=m.name,
            state_standard=m.state_standard,
            category=m.category,
            stamp=m.stamp,
            diameter=m.diameter,
            thickness=m.thickness,
            width=m.width,
            length=m.length,
            material=m.material,
            price=m.price,
            unit=m.unit,
            price_updated_at=m.price_updated_at,
            comments=m.comments,
            warehouse_id=wb.id,
        ))
    if to_insert:
        session.add_all(to_insert)
    await session.flush()

    # Очистка green-таблиц по данному городу/поставщику
    await session.execute(delete(MetalGreen).where(MetalGreen.warehouse_id == wg.id))
    await session.delete(wg)
    # await session.commit()


async def download_file(url: str, dest_path: str, retries: int = 3, delay: int = 5):
    """Асинхронно скачивает файл по URL и сохраняет по указанному пути, с возможностью повторных попыток."""
    # Используем httpx для асинхронных запросов
    async with httpx.AsyncClient(timeout=120.0, verify=False) as client:
        for attempt in range(retries):
            try:
                print(f"  - Попытка {attempt + 1}/{retries} скачать {url}")
                response = await client.get(url, follow_redirects=True)
                response.raise_for_status()  # Проверка на ошибки HTTP (4xx, 5xx)
                async with aiofiles.open(dest_path, 'wb') as f:
                    await f.write(response.content)
                print(f"  - Файл успешно скачан: {dest_path}")
                return dest_path
            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                print(f"  - Ошибка при скачивании {url} (попытка {attempt + 1}): {e}")
                if attempt + 1 == retries:
                    print(f"  - Все {retries} попытки не удались. Пропускаю файл.")
                    return None
                print(f"  - Повторная попытка через {delay} секунд...")
                await asyncio.sleep(delay)
            except Exception as e:
                print(f"  - Непредвиденная ошибка при скачивании файла {url}: {e}")
                return None
    return None

async def get_or_create_green_warehouse(
    session,
    *,
    city: str,
    supplier: str,
    phone: Optional[str] = None,
    email: Optional[str] = None,
    legal_entity: Optional[str] = None,
    working_hours: Optional[str] = None,
):
    q = await session.execute(
        select(WarehouseGreen).where(
            WarehouseGreen.city == city,
            WarehouseGreen.supplier == supplier,
        )
    )
    wh = q.scalar_one_or_none()
    if wh:
        if phone:
            wh.phone_number = phone
        if email:
            wh.email = email
        if legal_entity:
            wh.legal_entity = legal_entity
        if working_hours:
            wh.working_hours = working_hours
        return wh

    wh = WarehouseGreen(
        city=city,
        supplier=supplier,
        phone_number=phone,
        email=email,
        legal_entity=legal_entity,
        working_hours=working_hours,
    )
    session.add(wh)
    await session.flush()
    return wh

async def clear_green_tables_for_supplier(session, supplier: str):
    """Очищает все записи для конкретного поставщика в зеленых таблицах."""
    print(f"  - Очистка green-таблиц для поставщика: {supplier}")
    # Сначала удаляем металл, который ссылается на склады
    await session.execute(
        delete(MetalGreen).where(MetalGreen.warehouse_id.in_(
            select(WarehouseGreen.id).where(WarehouseGreen.supplier == supplier)
        ))
    )
    # Затем удаляем сами склады
    await session.execute(delete(WarehouseGreen).where(WarehouseGreen.supplier == supplier))
    await session.commit()


async def replace_green_products_for_warehouse(session, warehouse_id: int, products: List[dict]) -> None:
    await session.execute(delete(MetalGreen).where(MetalGreen.warehouse_id == warehouse_id))
    to_insert = []
    now = datetime.now()
    for p in products:
        if not p.get("name"):
            continue
        p["warehouse_id"] = warehouse_id
        p["price_updated_at"] = now
        to_insert.append(MetalGreen(**p))
    if to_insert:
        session.add_all(to_insert)

async def process_evraz_city(session, context, city_code: str, url: str):
    print(f"\n{'='*20}\nНачинаю обработку города: {city_code.upper()}\n{'='*20}")
    page = await context.new_page()
    file_path = None

    try:
        if city_code == "msk":
            print("  - Перехожу на https://evraz.market/pricelist/ и выбираю Москву вручную")
            await page.goto("https://evraz.market/pricelist/", wait_until="load", timeout=45_000)
            await select_moscow_if_needed(page)

        print(f"  - Перехожу на страницу: {url}")
        await page.goto(url, wait_until="load", timeout=45_000)

        file_path = await download_pricelist(page, city_code)

        products, warehouse_contacts = process_excel_file(file_path)
        print(f"  - Найдено {len(products)} позиций в прайс-листе.")

        city_name = CITY_CODES_TO_RUSSIAN.get(city_code, city_code.capitalize())
        phone = (warehouse_contacts or {}).get("phone")
        email = (warehouse_contacts or {}).get("email")

        wh_g = await get_or_create_green_warehouse(
            session,
            city=city_name,
            supplier=EVRAZ_SUPPLIER,
            phone=phone,
            email=email,
        )
        await replace_green_products_for_warehouse(session, wh_g.id, products)

        print(f"  - Данные для города {city_name} сохранены в green-таблицы.")

    finally:
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
                print(f"  - Временный файл {file_path} удален.")
        except Exception:
            pass

        await page.close()


async def process_mc_city_with_browser(session, context, city_name: str, urls: List[str]) -> None:
    """
    Парсинг Металлсервиса через Playwright: надёжнее, чем httpx.
    Складываем в GREEN, затем finalization в BLUE и очистка GREEN.
    """
    print(f"\n--- Металлсервис: {city_name} ---")
    all_products: List[dict] = []

    page = await context.new_page()
    try:
        await page.route(
            "**/*",
            lambda route: route.abort()
            if route.request.resource_type in {"image", "stylesheet", "font", "media"}
            else route.continue_(),
        )

        for url in urls:
            try:
                products, _ = await process_mc_page_with_page(page, url)
                all_products.extend(products)
                print(f"[MC] {city_name}: {len(products)} позиций ({url})")
            except Exception as e:
                print(f"[MC] FAIL {city_name}: {e} ({url})")
    finally:
        await page.close()

    if not all_products:
        print(f"[MC] {city_name}: ничего не распарсили")
        return

    wh_g = await get_or_create_green_warehouse(
        session,
        city=city_name,
        supplier=MC_SUPPLIER,
    )
    await replace_green_products_for_warehouse(session, wh_g.id, all_products)
    print(f"[MC] {city_name}: сохранено {len(all_products)} позиций в green-таблицы.")


async def process_metallotorg_city(session, city_name: str, url: str):
    """
    Скачивает PDF прайс-лист Металлоторга, парсит его и сохраняет данные.
    """
    print(f"\n--- Металлоторг: {city_name} ---")
    DOWNLOADS_DIR = "downloads"
    os.makedirs(DOWNLOADS_DIR, exist_ok=True)

    file_name = url.split('/')[-1]
    file_path = os.path.join(DOWNLOADS_DIR, f"metallotorg_{city_name.replace(' ', '_')}_{file_name}")

    try:
        downloaded_path = await download_file(url, file_path, retries=3)
        if not downloaded_path:
            return

        products = parse_metallotorg_pdf(downloaded_path)
        print(f"  - Найдено {len(products)} позиций в прайс-листе.")

        if not products:
            return

        wh_g = await get_or_create_green_warehouse(
            session, city=city_name, supplier=METALLOTORG_SUPPLIER
        )
        await replace_green_products_for_warehouse(session, wh_g.id, products)
        print(f"  - Данные для города {city_name} ({METALLOTORG_SUPPLIER}) сохранены в green-таблицы.")

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"  - Временный файл {file_path} удален.")

async def main():
    await create_tables()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )

        # Используем одну сессию для всего процесса
        async with AsyncSessionLocal() as session:
            try:
                # 1. Очищаем зеленые таблицы в начале транзакции
                print("="*50)
                print("ШАГ 1: Очистка green-таблиц перед запуском...")
                await clear_green_tables_for_supplier(session, EVRAZ_SUPPLIER)
                await clear_green_tables_for_supplier(session, MC_SUPPLIER)
                await clear_green_tables_for_supplier(session, METALLOTORG_SUPPLIER)
                print("Green-таблицы очищены.")
                print("="*50)

                # 2. Запускаем все парсеры, которые наполняют зеленые таблицы
                print("\nШАГ 2: Запуск парсеров для наполнения green-таблиц...")
                # EVRAZ
                MAX_RETRIES_EVRAZ = 2
                for city_code, url in CITIES.items():
                    for attempt in range(MAX_RETRIES_EVRAZ):
                        try:
                            await process_evraz_city(session, context, city_code, url)
                            break
                        except Exception as e:
                            print(f"!!! ОШИБКА при обработке города ЕВРАЗ '{city_code.upper()}' (попытка {attempt + 1}/{MAX_RETRIES_EVRAZ}): {e}")
                            if attempt + 1 >= MAX_RETRIES_EVRAZ:
                                print(f"!!! Все попытки для города '{city_code.upper()}' провалились. Пропускаю.")
                            else:
                                print("--- Повторная попытка через 5 секунд...")
                                await asyncio.sleep(5)

                # MC — тем же контекстом, город за городом
                for city_name, urls in MC_LINKS_BY_CITY.items():
                    try:
                        await process_mc_city_with_browser(session, context, city_name, urls)
                    except Exception as e:
                        print(f"!!! ОШИБКА при обработке города Металлсервис '{city_name}': {e}")

                # Metallotorg
                for city_name, url in METALLOTORG_LINKS_BY_CITY.items():
                    try:
                        await process_metallotorg_city(session, city_name, url)
                    except Exception as e:
                        print(f"!!! ОШИБКА при обработке города Металлоторг '{city_name}': {e}")

                # 3. Финализируем все данные из green в blue таблицы
                print("\nШАГ 3: Перенос всех данных из green в blue таблицы...")
                stmt = select(WarehouseGreen.supplier, WarehouseGreen.city).distinct()
                all_parsed_pairs = (await session.execute(stmt)).all()

                for supplier, city in all_parsed_pairs:
                    await finalize_green_to_blue(session, supplier=supplier, city=city)

                # 4. Коммитим всю транзакцию
                await session.commit()
                print("\n" + "="*50)
                print("Парсинг и обновление завершены успешно.")
                print("="*50)

            except Exception as e:
                print(f"\n!!! КРИТИЧЕСКАЯ ОШИБКА В ОСНОВНОМ БЛОКЕ: {e}. Откат транзакции.")
                await session.rollback()
            finally:
                await context.close()
                await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
