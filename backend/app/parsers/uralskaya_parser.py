import pandas as pd
import requests
import re
from typing import List, Dict, Optional
from datetime import datetime
import os

def parse_uralskaya_metals_file(filename: str) -> tuple[List[Dict], Dict]:
    """
    Парсит файл Уральской металлобазы и возвращает данные о металлах и контакты.
    """
    df = pd.read_excel(filename, header=None)
    
    non_empty_rows: pd.DataFrame = df[df.notna().any(axis=1)]
        
    contacts = None
    
    header_rows = []
    for idx, row in non_empty_rows.iterrows():
        if idx == 10:
            contacts = str(row.iloc[1])
        if idx == 11:
            contacts += str(row.iloc[1]) 
        if 'М/ст' in str(row.iloc[1]) and 'Размер' in str(row.iloc[2]):
            header_rows.append(idx)
    
    if contacts:
        contacts = contacts.split(",")[0].strip()
    
    print(f"Найдено заголовков таблиц: {header_rows}")
    
    current_category = None
    current_gost = None
    current_unit = None
    metals_data = []
    
    for idx, row in non_empty_rows.iterrows():
        
        if pd.notna(row.iloc[1]) and 'ГОСТ' in str(row.iloc[1]):
            splitted = str(row.iloc[1]).split('ГОСТ', maxsplit=1)
            current_category = splitted[0].strip()
            current_gost = ('ГОСТ ' + splitted[1].strip()) if len(splitted) > 1 else None
            print(f"Найден ГОСТ: {current_gost}")
            continue
        
        if idx in header_rows:
            print(f"Найден заголовок таблицы в строке {idx}")
            current_unit = str(row.iloc[4]).split(',')[1].strip()
            continue
        
        if (pd.notna(row.iloc[1]) and pd.notna(row.iloc[2]) and pd.notna(row.iloc[4]) and
            any(idx > header_row for header_row in header_rows)):
            try:
                quantity_str = str(row.iloc[4]).replace(',', '.').strip()
                quantity = float(quantity_str)
                
                if quantity > 0:
                    # Извлекаем размеры из строки размера
                    size_str = str(row.iloc[2]).strip()
                    thickness, diameter, width, length = parse_dimensions(size_str)
                    
                    # Парсим цену
                    price_str = str(row.iloc[5]).strip() if pd.notna(row.iloc[5]) else ''
                    price = parse_price(price_str)
                    
                    metal_info = {
                        'name': str(row.iloc[1]).strip(),
                        'category': current_category,
                        'state_standard': current_gost,
                        'stamp': str(row.iloc[1]).strip(),  # Марка стали
                        'thickness': thickness,
                        'diameter': diameter,
                        'width': width,
                        'length': length,
                        'material': None,
                        'price': price,
                        'unit': current_unit,
                        'comments': str(row.iloc[3]).strip() if pd.notna(row.iloc[3]) else '',
                    }
                    
                    metals_data.append(metal_info)
            except (ValueError, TypeError):
                continue
    
    warehouse_contacts = {
        'phone': extract_phone(contacts) if contacts else None,
        'email': extract_email(contacts) if contacts else None,
        'legal_entity': 'Уральская металлобаза',
        'working_hours': None
    }
    
    return metals_data, warehouse_contacts


def parse_dimensions(size_str: str) -> tuple[Optional[float], Optional[float], Optional[float], Optional[float]]:
    """Извлекает размеры из строки размера"""
    thickness = None
    diameter = None
    width = None
    length = None
    
    # Ищем числа в строке
    numbers = re.findall(r'(\d+(?:[.,]\d+)?)', size_str)
    
    if numbers:
        # Первое число обычно толщина или диаметр
        thickness = parse_dimension(numbers[0])
        
        # Если есть второе число, это может быть диаметр
        if len(numbers) > 1:
            diameter = parse_dimension(numbers[1])
        
        # Если есть третье число, это может быть ширина
        if len(numbers) > 2:
            width = parse_dimension(numbers[2])
        
        # Если есть четвертое число, это может быть длина
        if len(numbers) > 3:
            length = parse_dimension(numbers[3])
    
    return thickness, diameter, width, length


def parse_dimension(value: str) -> Optional[float]:
    """Преобразует строковое значение размера в число"""
    try:
        cleaned_value = value.replace(',', '.')
        return float(cleaned_value)
    except (ValueError, TypeError):
        return None


def parse_price(price_str: str) -> Optional[float]:
    """Парсит цену из строки"""
    if not price_str or price_str.lower() in ['nan', 'none', '']:
        return None
    
    # Ищем числа в строке
    numbers = re.findall(r'(\d+(?:[\s\u00A0]\d+)*)', price_str)
    if numbers:
        num = numbers[-1].replace(' ', '').replace('\u00A0', '')
        try:
            return float(num)
        except ValueError:
            return None
    
    return None


def extract_phone(text: str) -> Optional[str]:
    """Извлекает телефон из текста"""
    if not text:
        return None
    
    phone_match = re.search(r'[+\d\s\-\(\)]{8,}', text)
    if phone_match:
        return phone_match.group(0).strip()
    return None


def extract_email(text: str) -> Optional[str]:
    """Извлекает email из текста"""
    if not text:
        return None
    
    email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
    if email_match:
        return email_match.group(0).strip()
    return None


async def process_uralskaya_metallobaza(session, city_name: str = "Екатеринбург"):
    """
    Обрабатывает данные Уральской металлобазы
    """
    print(f"\n--- Уральская металлобаза: {city_name} ---")
    
    DOWNLOAD_LINK = "https://pmsmk.ru/f/nalichie_td_uralskaya_metallobaza.xls"
    DOWNLOADS_DIR = "downloads"
    os.makedirs(DOWNLOADS_DIR, exist_ok=True)
    
    file_name = "uralskaya_metallobaza.xls"
    file_path = os.path.join(DOWNLOADS_DIR, file_name)
    
    try:
        # Скачиваем файл
        response = requests.get(DOWNLOAD_LINK, timeout=30)
        response.raise_for_status()
        
        with open(file_path, "wb") as output_file:
            output_file.write(response.content)
        
        print(f"  - Файл успешно скачан: {file_path}")
        
        # Парсим данные
        products, warehouse_contacts = parse_uralskaya_metals_file(file_path)
        print(f"  - Найдено {len(products)} позиций в прайс-листе.")
        
        if not products:
            print("  - Не найдено товаров с наличием больше 0")
            return
        
        # Сохраняем в базу данных
        from app.models.warehouse import WarehouseGreen
        from app.models.metal import MetalGreen
        from datetime import datetime
        from sqlalchemy import select, delete
        
        # Создаем или получаем склад
        wh_g = await session.scalar(
            select(WarehouseGreen).where(
                WarehouseGreen.city == city_name,
                WarehouseGreen.supplier == "Уральская металлобаза"
            )
        )
        
        if not wh_g:
            wh_g = WarehouseGreen(
                city=city_name,
                supplier="Уральская металлобаза",
                phone_number=warehouse_contacts.get('phone'),
                email=warehouse_contacts.get('email'),
                legal_entity=warehouse_contacts.get('legal_entity'),
                working_hours=warehouse_contacts.get('working_hours'),
            )
            session.add(wh_g)
            await session.flush()
        
        # Очищаем старые данные и добавляем новые
        await session.execute(delete(MetalGreen).where(MetalGreen.warehouse_id == wh_g.id))
        
        to_insert = []
        now = datetime.now()
        for product in products:
            if not product.get("name"):
                continue
            product["warehouse_id"] = wh_g.id
            product["price_updated_at"] = now
            to_insert.append(MetalGreen(**product))
        
        if to_insert:
            session.add_all(to_insert)
        
        print(f"  - Данные для города {city_name} (Уральская металлобаза) сохранены в green-таблицы.")
        
    except Exception as e:
        print(f"  - Ошибка при обработке Уральской металлобазы: {e}")
    
    finally:
        # Удаляем временный файл
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"  - Временный файл {file_path} удален.")
