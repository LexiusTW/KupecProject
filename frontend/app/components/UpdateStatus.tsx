'use client';

import { useEffect, useState } from 'react';

const API_BASE_URL = 'https://ekbmetal.cloudpub.ru';

function formatUpdateTime(isoString: string | null): string {
  if (!isoString) {
    return 'Данные еще не обновлялись';
  }

  const updateDate = new Date(isoString);
  const now = new Date();

  const time = updateDate.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Клонируем даты, чтобы не изменять оригиналы
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const updateDay = new Date(updateDate);
  updateDay.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - updateDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Обновлено сегодня в ${time}`;
  }

  if (diffDays === 1) {
    return `Обновлено вчера в ${time}`;
  }

  const date = updateDate.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  });

  return `Обновлено ${date} в ${time}`;
}

export default function UpdateStatus() {
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    const fetchTime = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/last-update-time`);
        const data = await res.json();
        setLastUpdate(data.last_update);
      } catch (error) {
        console.error('Ошибка при получении времени обновления:', error);
      }
    };

    fetchTime();
  }, []);

  return (
    <div className="text-sm text-gray-500">{formatUpdateTime(lastUpdate)}</div>
  );
}