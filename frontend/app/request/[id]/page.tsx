// path: app/request/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import Notification, { NotificationProps } from '@/app/components/Notification';

interface RequestItem {
  id: number;
  kind: string;
  category?: string | null;
  quantity?: number | null;
  unit?: string | null;
  name?: string | null;
  size?: string | null;
  dims?: string | null;
  stamp?: string | null;
  state_standard?: string | null;
  comment?: string | null;
  allow_analogs?: boolean | null;
}

interface Counterparty {
  id: number;
  short_name: string;
}

interface RequestData {
  display_id: string;
  id: string;
  comment?: string | null;
  delivery_address?: string | null;
  delivery_at?: string | null;
  created_at: string;
  items: RequestItem[];
  counterparty?: Counterparty | null;
  status?: string | null;
}

export default function RequestPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string | undefined;
  const token = searchParams.get('token');
  const [requestData, setRequestData] = useState<RequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prices, setPrices] = useState<Record<number, string>>({});

  const [notifications, setNotifications] = useState<Omit<NotificationProps, 'onDismiss'>[]>([]);
  const addNotification = (notif: Omit<NotificationProps, 'id' | 'onDismiss'>) => {
    const nid = crypto.randomUUID();
    setNotifications(prev => [...prev, { id: nid, ...notif }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== nid)), 6000);
  };

  useEffect(() => {
    if (!id) {
      setError('Не указан id заявки');
      setLoading(false);
      return;
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    setLoading(true);
    fetch(`${apiUrl}/api/v1/requests/${id}`)
      .then(res => {
        if (!res.ok) throw new Error(`Ошибка загрузки: ${res.status}`);
        return res.json();
      })
      .then((data: RequestData) => {
        setRequestData(data);
        // инициализируем цены пустыми строками для каждой позиции
        const initPrices: Record<number, string> = {};
        (data.items || []).forEach(it => { initPrices[it.id] = ''; });
        setPrices(initPrices);
      })
      .catch(err => {
        console.error(err);
        setError(err.message || 'Не удалось загрузить заявку');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const onChangePrice = (itemId: number, val: string) => {
    // допускаем только цифры, запятую/точку — не навязываем, но простая фильтрация
    const cleaned = val.replace(/[^\d.,]/g, '');
    setPrices(prev => ({ ...prev, [itemId]: cleaned }));
  };

  const handleSubmitOffer = async () => {
    if (!requestData || !id) return;

    if (!token) {
      addNotification({ type: 'error', title: 'Ошибка', message: 'Отсутствует токен для отправки предложения.' });
      return;
    }

    const payloadItems = Object.entries(prices)
      .map(([key, val]) => ({ request_item_id: Number(key), price: val.trim() ? val.replace(',', '.') : null }));

    const missing = payloadItems.filter(pi => !pi.price || isNaN(Number(pi.price)));
    if (missing.length) {
      addNotification({ type: 'warning', title: 'Неполные цены', message: 'Укажите цену для всех позиций в числовом формате.' });
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/v1/requests/${id}/offers?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: payloadItems.map(p => ({ request_item_id: p.request_item_id, price: Number(p.price) })),
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        if (res.status === 400 && errBody.detail?.includes("already been submitted")) {
             addNotification({ type: 'warning', title: 'Предложение уже отправлено', message: 'Вы уже отправляли предложение по этой заявке.' });
        } else {
            throw new Error(errBody.detail || `Ошибка сервера: ${res.status}`);
        }
        return;
      }

      setRequestData(prev => prev ? { ...prev, status: 'Предложено' } : prev);
      addNotification({ type: 'success', title: 'Предложение отправлено', message: 'Ваши цены успешно отправлены.' });
    } catch (e: any) {
      console.error(e);
      addNotification({ type: 'error', title: 'Ошибка отправки', message: e?.message || 'Не удалось отправить предложение.' });
    }
  };

  return (
    // фон сделан таким же как на других страницах
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 flex flex-col">
      <Header showNav={false} />

      {/* уведомления справа сверху */}
      <div className="fixed top-24 right-5 z-50 w-full max-w-sm space-y-3">
        {notifications.map(n => (
          // Notification принимает onDismiss — передаём функцию удаления
          <Notification
            key={n.id}
            {...n}
            onDismiss={(id) => setNotifications(prev => prev.filter(x => x.id !== id))}
          />
        ))}
      </div>

      <main className="flex-grow container mx-auto px-4 py-8 sm:py-12">
        {loading ? (
          <div className="text-center py-14">Загрузка...</div>
        ) : error ? (
          <div className="bg-white p-6 rounded-xl shadow text-red-600 max-w-3xl mx-auto">{error}</div>
        ) : !requestData ? (
          <div className="bg-white p-6 rounded-xl shadow max-w-3xl mx-auto">Заявка не найдена.</div>
        ) : (
          <div className="bg-white rounded-xl shadow p-6 mx-auto space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Заявка №{requestData.display_id}</h1>
                <p className="text-sm text-gray-500 mt-1">Создана: {new Date(requestData.created_at).toLocaleString()}</p>
                {requestData.counterparty && <p className="text-sm text-gray-600 mt-2">Заказчик: {requestData.counterparty.short_name}</p>}
              </div>

              <div>
                {/* Статус */}
                <span
                  className={`text-sm font-semibold px-3 py-1 rounded-full ${
                    requestData.status === 'Предложено' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {requestData.status || 'Новая'}
                </span>
              </div>
            </div>

            {/* Информация о доставке / коммент */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700">Адрес доставки</h3>
                <p className="text-sm text-gray-600 mt-1">{requestData.delivery_address || '—'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700">Дата поставки</h3>
                <p className="text-sm text-gray-600 mt-1">{requestData.delivery_at ? new Date(requestData.delivery_at).toLocaleString() : '—'}</p>
              </div>
            </div>

            {/* Таблица позиций — с input'ами для цены */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Позиции заявки</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
 <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Категория</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Наименование</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Размер</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">ГОСТ</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Марка</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Аналоги</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Количество</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Ед.изм.</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Комментарий</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Ваша цена (за ед.)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Общая цена</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {requestData.items.map(item => {
                      const itemPrice = parseFloat(prices[item.id]?.replace(',', '.') || '0');
                      const totalItemPrice = itemPrice * (item.quantity || 0);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.kind === 'metal' ? 'Металлопрокат' : item.category || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {item.kind === 'metal' ? item.category : item.name || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.kind === 'metal' ? item.size || '—' : item.dims || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.kind === 'metal' ? item.state_standard || '—' : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.kind === 'metal' ? item.stamp || '—' : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.kind === 'metal' ? (item.allow_analogs ? 'Да' : 'Нет') : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {item.quantity ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {item.unit ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.comment || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2 items-center">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={prices[item.id] ?? ''}
                                onChange={(e) => onChangePrice(item.id, e.target.value)}
                                placeholder="0.00"
                                className="w-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
                              <span className="text-sm text-gray-500">₽</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {totalItemPrice > 0 ? `${totalItemPrice.toFixed(2)} ₽` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Кнопка отправки предложения */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleSubmitOffer}
                className="px-5 py-2 bg-amber-600 text-white rounded-md font-semibold hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                Отправить предложение
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
