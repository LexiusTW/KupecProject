import pandas as pd

def parse_metals_file(filename):
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
                    metal_info = {
                        'Категория': current_category,
                        'ГОСТ': current_gost,
                        'Марка стали': str(row.iloc[1]).strip(),
                        'Размер': str(row.iloc[2]).strip(),
                        'Примечания': str(row.iloc[3]).strip() if pd.notna(row.iloc[3]) else '',
                        'Склад': quantity,
                        'Един. измер.': current_unit,
                        'Цена руб. с НДС': str(row.iloc[5]).strip() if pd.notna(row.iloc[5]) else '', # т.е. цена за единицу измерения (тонну например)
                        'Контактная информация': contacts
                    }
                    
                    metals_data.append(metal_info)
            except (ValueError, TypeError):
                continue
    
    if metals_data:
        result_df = pd.DataFrame(metals_data)
         
        result_df = result_df[result_df['Категория'].notna() & (result_df['Категория'] != 'None')]
        
        output_filename = 'filtered_metals.xlsx'
        result_df.to_excel(output_filename, index=False)
        
        csv_filename = 'filtered_metals.csv'
        result_df.to_csv(csv_filename, index=False, encoding='utf-8-sig')
        
        print(f"Обработано {len(result_df)} позиций металлов с наличием больше 0")
        print(f"Результат сохранен в файлы: {output_filename} и {csv_filename}")
        
        print("\nПервые 10 позиций:")
        print(result_df.head(10).to_string(index=False))
        
        print(f"\nСтатистика по ГОСТам:")
        gost_stats = result_df['ГОСТ'].value_counts()
        print(gost_stats)
        
        print(f"\nОбщая статистика:")
        print(f"Всего позиций: {len(result_df)}")
        print(f"Уникальных ГОСТов: {result_df['ГОСТ'].nunique()}")
        print(f"Общее количество на складе: {result_df['Склад'].sum():.2f} тн") # могут быть не только тонны
        
        print(f"\nТоп-10 марок стали по количеству позиций:")
        steel_stats = result_df['Марка стали'].value_counts().head(10)
        print(steel_stats)
        
        print(f"\nНайденные ГОСТы:")
        for gost in result_df['ГОСТ'].unique():
            count = len(result_df[result_df['ГОСТ'] == gost])
            print(f"- {gost}: {count} позиций")
        
    else:
        print("Не найдено металлов с наличием больше 0")