#!/usr/bin/env python3
"""
Тестовый скрипт для проверки интеграции WebSocket CRM и парсера
"""

import asyncio
import requests
import json
from datetime import datetime

# Конфигурация
API_BASE_URL = "http://localhost:8000/api/v1"
CRM_BASE_URL = f"{API_BASE_URL}/crm"

def test_crm_api():
    """Тестирует CRM API endpoints"""
    print("🧪 Тестирование CRM API...")
    
    # Тест 1: Создание пользователя
    print("\n1. Создание пользователя...")
    user_data = {
        "username": "test_user",
        "email": "test@example.com",
        "full_name": "Test User"
    }
    
    try:
        response = requests.post(f"{CRM_BASE_URL}/users/", json=user_data)
        if response.status_code == 200:
            user = response.json()
            print(f"✅ Пользователь создан: {user['username']} (ID: {user['id']})")
            user_id = user['id']
        else:
            print(f"❌ Ошибка создания пользователя: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Ошибка подключения к API: {e}")
        return False
    
    # Тест 2: Получение списка пользователей
    print("\n2. Получение списка пользователей...")
    try:
        response = requests.get(f"{CRM_BASE_URL}/users/")
        if response.status_code == 200:
            users = response.json()
            print(f"✅ Найдено пользователей: {len(users)}")
        else:
            print(f"❌ Ошибка получения пользователей: {response.status_code}")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    
    # Тест 3: Создание чата
    print("\n3. Создание чата...")
    chat_data = {
        "participant_ids": [user_id, 1]  # Предполагаем, что есть пользователь с ID 1
    }
    
    try:
        response = requests.post(f"{CRM_BASE_URL}/chats/", json=chat_data)
        if response.status_code == 200:
            chat = response.json()
            print(f"✅ Чат создан: ID {chat['id']}")
            chat_id = chat['id']
        else:
            print(f"❌ Ошибка создания чата: {response.status_code}")
            print(f"Ответ: {response.text}")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    
    # Тест 4: Отправка сообщения
    print("\n4. Отправка сообщения...")
    message_data = {
        "receiver_id": 1,
        "content": f"Тестовое сообщение от {datetime.now()}"
    }
    
    try:
        response = requests.post(f"{CRM_BASE_URL}/messages/", json=message_data, params={"sender_id": user_id})
        if response.status_code == 200:
            message = response.json()
            print(f"✅ Сообщение отправлено: ID {message['id']}")
        else:
            print(f"❌ Ошибка отправки сообщения: {response.status_code}")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    
    return True

def test_search_api():
    """Тестирует основной поисковый API"""
    print("\n🧪 Тестирование поискового API...")
    
    try:
        response = requests.get(f"{API_BASE_URL}/search", params={"limit": 5})
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Поиск работает: найдено {data['total']} товаров")
        else:
            print(f"❌ Ошибка поиска: {response.status_code}")
    except Exception as e:
        print(f"❌ Ошибка подключения к поиску: {e}")

def test_filters_api():
    """Тестирует API фильтров"""
    print("\n🧪 Тестирование API фильтров...")
    
    endpoints = [
        "/suppliers",
        "/categories", 
        "/cities",
        "/stamps",
        "/gosts"
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{API_BASE_URL}/filters{endpoint}")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ {endpoint}: {len(data)} значений")
            else:
                print(f"❌ {endpoint}: ошибка {response.status_code}")
        except Exception as e:
            print(f"❌ {endpoint}: {e}")

def test_main_api():
    """Тестирует основной API"""
    print("\n🧪 Тестирование основного API...")
    
    try:
        response = requests.get("http://localhost:8000/")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API работает: {data['message']}")
            print(f"   Версия: {data.get('version', 'N/A')}")
            print(f"   Функции: {len(data.get('features', []))}")
        else:
            print(f"❌ Ошибка основного API: {response.status_code}")
    except Exception as e:
        print(f"❌ Ошибка подключения к основному API: {e}")

def main():
    """Основная функция тестирования"""
    print("🚀 Запуск тестов интеграции...")
    print("=" * 50)
    
    # Проверяем, что сервер запущен
    try:
        response = requests.get("http://localhost:8000/", timeout=5)
        if response.status_code != 200:
            print("❌ Сервер не отвечает на порту 8000")
            print("   Убедитесь, что backend запущен: python run.py")
            return
    except Exception as e:
        print("❌ Не удается подключиться к серверу")
        print("   Убедитесь, что backend запущен: python run.py")
        return
    
    print("✅ Сервер доступен")
    
    # Запускаем тесты
    test_main_api()
    test_search_api()
    test_filters_api()
    test_crm_api()
    
    print("\n" + "=" * 50)
    print("🎉 Тестирование завершено!")
    print("\n📋 Следующие шаги:")
    print("1. Проверьте логи сервера на наличие ошибок")
    print("2. Протестируйте WebSocket соединения")
    print("3. Запустите парсеры: python run_parsers.py")

if __name__ == "__main__":
    main()
