import os
from playwright.async_api import Page, TimeoutError as PWTimeout

DOWNLOADS_DIR = "downloads"


async def select_moscow_if_needed(page: Page) -> None:
    """
    Для главной витрины evraz.market: ты просил именно так —
    1) Кликаем 'Сменить филиал'
    2) В модалке выбираем 'Москва и МО'
    """
    try:
        change_region = page.locator("a.pricelist-change-region-link").first
        await change_region.wait_for(state="visible", timeout=10_000)
        await change_region.click()
        # ссылка "Москва и МО"
        moscow_link = page.locator("a.evraz-location-city", has_text="Москва и МО").first
        await moscow_link.wait_for(state="visible", timeout=10_000)
        await moscow_link.click()
        # дождаться перезагрузки
        await page.wait_for_load_state("load")
        await page.wait_for_timeout(1000)
    except Exception:
        # best-effort: если нет модалки — тихо продолжаем
        pass


async def download_pricelist(page, city_code):
    """
    ТВОЙ «правильный» алгоритм:
      - ждём именно a.js-download--total-xlsx (visible)
      - кликаем с expect_download()
      - сохраняем файл как {city_code}_{suggested_filename}
    """
    download_button_selector = "a.js-download--total-xlsx"
    os.makedirs(DOWNLOADS_DIR, exist_ok=True)

    print("  - Ожидание появления кнопки для скачивания...")
    download_button = page.locator(download_button_selector).first
    # Уменьшаем таймаут ожидания кнопки, чтобы быстрее падать, если ее нет
    await download_button.wait_for(state="visible", timeout=30_000)

    # --- Новая логика с несколькими попытками клика ---
    max_click_attempts = 3
    for attempt in range(max_click_attempts):
        print(f"  - Попытка скачивания файла {attempt + 1}/{max_click_attempts}...")
        try:
            # Уменьшаем таймаут ожидания самого скачивания
            async with page.expect_download(timeout=45_000) as download_info:
                # Кликаем с небольшим таймаутом на сам клик
                await download_button.click(force=True, timeout=5_000)

            download = await download_info.value
            suggested_filename = download.suggested_filename or "pricelist.xlsx"
            file_path = os.path.join(DOWNLOADS_DIR, f"{city_code}_{suggested_filename}")
            await download.save_as(file_path)
            print(f"  - Файл успешно скачан и сохранен как: {file_path}")
            return file_path  # Успех, выходим из функции

        except PWTimeout:
            print(f"    - Таймаут на попытке {attempt + 1}. Повторяю...")
            if attempt + 1 < max_click_attempts:
                await page.wait_for_timeout(2000)  # Небольшая пауза перед повторной попыткой
            else:
                print("  - Не удалось скачать файл после нескольких попыток клика.")
                raise  # Пробрасываем исключение, чтобы сработал внешний retry для всего города
