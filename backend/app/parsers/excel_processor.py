import pandas as pd
import re
import os
from typing import Optional

def capitalize_category(s: Optional[str]) -> Optional[str]:
    """Приводит строку к виду 'Первая заглавная, остальные строчные'."""
    if not s or not isinstance(s, str):
        return s
    return s.strip().capitalize()

def parse_dimension(value):
    """Преобразует строковое значение размера в число, удаляя 'мм' и заменяя ',' на '.'."""
    if pd.isna(value):
        return None
    try:
        cleaned_value = str(value)
        if not re.search(r'\d', cleaned_value):
            return None
        cleaned_value = re.sub(r'[^\d,.]', '', cleaned_value).replace(',', '.')
        if not cleaned_value:
            return None
        return float(cleaned_value)
    except (ValueError, TypeError):
        return None

def parse_price(value):
    """Парсит цену из строки, приоритет — цена за 1 т"""
    if pd.isna(value):
        return None

    value_str = str(value).strip()
    if not value_str or value_str.lower() in ['nan', 'none', '']:
        return None

    # Ищем цену за 1 т
    match_ton = re.search(r'(\d+(?:[\s\u00A0]\d+)*)\s*за\s*1\s*т', value_str, flags=re.IGNORECASE)
    if match_ton:
        price_str = match_ton.group(1).replace(' ', '').replace('\u00A0', '')
        try:
            return float(price_str)
        except ValueError:
            return None

    # fallback: просто взять последнее число
    numbers = re.findall(r'(\d+(?:[\s\u00A0]\d+)*)', value_str)
    if numbers:
        num = numbers[-1].replace(' ', '').replace('\u00A0', '')
        try:
            return float(num)
        except ValueError:
            return None

    return None

def parse_thickness_from_name(name_string):
    """Извлекает толщину/диаметр из строки 'Номенклатура', находя последнее число."""
    if not isinstance(name_string, str):
        return None
    matches = re.findall(r'(\d+([.,]\d+)?)', name_string)
    if matches:
        last_match = matches[-1][0]
        return parse_dimension(last_match)
    return None

def extract_contacts(df):
    """Извлекает телефон и email из ячейки C1 (строка 0, колонка 2)."""
    contacts = {'phone': None, 'email': None}
    
    # Проверяем, что есть ячейка C1
    if len(df.columns) > 2 and len(df) > 0:
        c1_value = df.iloc[0, 2]
        if pd.notna(c1_value):
            text = str(c1_value)
            
            # Ищем телефон
            phone_match = re.search(r'Телефон:\s*([+\d\s\-\(\)]{8,})', text, re.IGNORECASE)
            if phone_match:
                contacts['phone'] = phone_match.group(1).strip()
            
            # Ищем email
            email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
            if email_match:
                contacts['email'] = email_match.group(0).strip()
    
    return contacts

def process_excel_file(file_path):
    """
    Извлекает данные о металлоконструкциях и контакты из Excel-файла.
    Возвращает кортеж: (список товаров, словарь с контактами).
    """
    all_products = []
    warehouse_contacts = {}
    
    try:
        with pd.ExcelFile(file_path) as xls:
            is_first_sheet = True
            for sheet_name in xls.sheet_names:
                print(f"\nОбрабатываю лист: '{sheet_name}'")
                df = pd.read_excel(xls, sheet_name=sheet_name, header=None)

                if is_first_sheet:
                    warehouse_contacts = extract_contacts(df)
                    print(f"  - Найденные контакты: {warehouse_contacts}")
                    is_first_sheet = False

                header_row_index = -1
                for i in range(len(df)):
                    if 'Номенклатура' in df.iloc[i].astype(str).values:
                        header_row_index = i
                        break
                
                if header_row_index == -1:
                    print(f"  - Не удалось найти заголовок 'Номенклатура' на листе '{sheet_name}'. Пропускаю.")
                    continue
                
                # Категорией будет название листа
                category_name = capitalize_category(sheet_name.strip())
                print(f"  - Установлена категория: '{category_name}'")

                header_df = df.iloc[header_row_index:header_row_index + 2].copy()
                header_df.iloc[0] = header_df.iloc[0].ffill()
                
                data_df = df.iloc[header_row_index + 2:].copy()
                data_df.columns = pd.MultiIndex.from_frame(header_df.T)
                
                column_map = {
                    'name': 'Номенклатура', 'state_standard': 'ГОСТ/ТУ',
                    'stamp': 'Марка стали',
                    'length': 'Длина, м', 'width': 'Ширина, м'
                }
                
                final_col_map = {}
                price_col = None
                min_volume_cols = []

                for col in data_df.columns:
                    h1, h2 = str(col[0]).lower(), str(col[1]).lower()
                    
                    # Ищем колонки с ценой за 1 т в разных объемах
                    if 'цена за 1 т' in h2:
                        if 'до 0,1 т' in h1:
                            min_volume_cols.append((0.1, col))
                        elif 'до 0,25 т' in h1 or '0,1 - 0,25 т' in h1:
                            min_volume_cols.append((0.25, col))
                        elif '0,25 - 0,5 т' in h1:
                            min_volume_cols.append((0.5, col))
                        elif '0,5 - 1 т' in h1:
                            min_volume_cols.append((1.0, col))
                        elif 'от 1 т' in h1:
                            min_volume_cols.append((999.0, col))  # Самый большой объем
                     
                    # Маппинг остальных колонок
                    for key, val in column_map.items():
                        if val.lower() in h1 or val.lower() in h2:
                            final_col_map[key] = col
                
                # Выбираем колонку с минимальным объемом
                if min_volume_cols:
                    min_volume_cols.sort(key=lambda x: x[0])  # Сортируем по объему
                    price_col = min_volume_cols[0][1]
                    print(f"  - Выбрана колонка с ценой: ('{price_col[0]}', '{price_col[1]}') - объем {min_volume_cols[0][0]} т")
                
                if price_col:
                    print(f"  - Найдена колонка с ценой: ('{price_col[0]}', '{price_col[1]}')")
                else:
                    print("  - ВНИМАНИЕ: Колонка с ценой ('до 0,1 т', 'Цена за 1 т') не найдена.")

                if 'name' not in final_col_map:
                    print(f"  - Не удалось определить колонку 'Номенклатура'. Пропускаю лист.")
                    continue
                
                for _, row in data_df.iterrows():
                    name_val = row.get(final_col_map['name'])
                    if pd.isna(name_val):
                        continue
                    if pd.notna(row.iloc[0]) and pd.isna(row.iloc[1]):
                        continue

                    product_data = {}

                    # Устанавливаем категорию и обнуляем материал
                    product_data['category'] = category_name
                    product_data['material'] = None 

                    for field, col_name in final_col_map.items():
                        if not col_name: continue
                        raw_value = row.get(col_name)
                        
                        if field in ['name', 'state_standard', 'stamp']:
                            value = str(raw_value).strip() if pd.notna(raw_value) else None
                            product_data[field] = value if value else None
                        elif field in ['length', 'width']:
                             product_data[field] = parse_dimension(raw_value)
                        else:
                             product_data[field] = raw_value if pd.notna(raw_value) else None
                    
                    # Добавляем цену из найденной колонки
                    product_data['price'] = parse_price(row.get(price_col)) if price_col else None
                    
                    product_data['thickness'] = parse_thickness_from_name(product_data.get('name'))
                    product_data['comments'] = None
                    
                    all_products.append(product_data)

    except Exception as e:
        print(f"Не удалось открыть или обработать Excel файл: {file_path}. Ошибка: {e}")
        return [], {}
    
    print(f"\nОбработка файла {os.path.basename(file_path)} завершена. Найдено товаров: {len(all_products)}")
    return all_products, warehouse_contacts