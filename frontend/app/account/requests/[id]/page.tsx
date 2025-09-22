'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import SkeletonLoader from '@/app/components/SkeletonLoader';
import Notification, { NotificationProps } from '@/app/components/Notification';

const API_BASE_URL = 'https://kupecbek.cloudpub.ru';

// ─────────── TYPES ─────────── //

type RequestItem = {
  id: number;
  kind: 'metal' | 'generic';
  category: string | null;
  name: string | null;
  dims: string | null;
  uom: string | null;
  note: string | null;
  quantity: number | null;
  comment: string | null;
  size: string | null;
  stamp: string | null;
  state_standard: string | null;
  unit: string | null;
};

type OfferItem = {
  id: number;
  request_item_id: number;
  price: number;
};

type Supplier = {
  id: number;
  short_name: string;
};

type Offer = {
  id: number;
  supplier: Supplier;
  comment: string | null;
  created_at: string;
  items: OfferItem[];
};

type Counterparty = {
  id: number;
  short_name: string;
};

type RequestDetails = {
  id: string;
  display_id: number;
  comment: string | null;
  delivery_address: string | null;
  delivery_at: string | null;
  created_at: string;
  status: string;
  items: RequestItem[];
  offers: Offer[];
  counterparty: Counterparty | null;
};

// ─────────── HELPER COMPONENTS ─────────── //

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'new':
      return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Новая</span>;
    case 'pending':
      return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Ожидает</span>;
    case 'awarded':
      return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">В работе</span>;
    case 'closed':
      return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Закрыта</span>;
    default:
      return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
  }
};

const InfoBlock = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-sm text-gray-500">{label}</p>
    <p className="text-md font-semibold text-gray-800">{value || '—'}</p>
  </div>
);

// ─────────── MAIN COMPONENT ─────────── //

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [request, setRequest] = useState<RequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<RequestItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notifications, setNotifications] = useState<Omit<NotificationProps, 'onDismiss'>[]>([]);

  const addNotification = (notif: Omit<NotificationProps, 'id' | 'onDismiss'>) => {
    const notifId = crypto.randomUUID();
    setNotifications(prev => [...prev, { id: notifId, ...notif }]);
  };
  const removeNotification = (notifId: string) => setNotifications(prev => prev.filter(n => n.id !== notifId));


  useEffect(() => {
    if (!id) return;

    async function fetchRequestDetails() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${API_BASE_URL}/api/v1/requests/${id}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.detail || 'Не удалось загрузить детали заявки');
        }
        const data = await response.json();
        setRequest(data);
        if (data.status === 'awarded') {
            addNotification({type: 'warning', title: 'Заявка в работе', message: 'По этой заявке уже выбран поставщик. Перенаправляем на страницу сделки...'});
            setTimeout(() => router.push(`/deals/${data.id}`), 3000);
        }
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    }

    fetchRequestDetails();
  }, [id, router]);

  const getBestOffer = (itemId: number) => {
    const relevantOffers = request?.offers.flatMap(offer => 
      offer.items.filter(item => item.request_item_id === itemId).map(item => ({ ...item, supplierName: offer.supplier.short_name }))
    ) || [];

    if (relevantOffers.length === 0) return null;

    return relevantOffers.reduce((best, current) => (current.price < best.price ? current : best));
  };

  const getOffersForPosition = (itemId: number) => {
    return request?.offers.filter(offer => offer.items.some(item => item.request_item_id === itemId)) || [];
  };

  const handleChooseOffer = async (offerId: number) => {
    if (!request) return;
    setIsSubmitting(true);
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/requests/${request.id}/offers/${offerId}/award`, {
            method: 'POST',
            credentials: 'include',
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || 'Не удалось выбрать предложение');
        }

        addNotification({type: 'success', title: 'Предложение выбрано', message: 'Поставщику отправлено уведомление. Перенаправляем на страницу сделки...'});

        setTimeout(() => {
            router.push(`/deals/${request.id}`);
        }, 3000);

    } catch (e: any) {
        addNotification({type: 'error', title: 'Ошибка', message: e.message});
    } finally {
        setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <SkeletonLoader className="h-64 w-full" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow p-6 text-red-600 text-center">{error}</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow p-6 text-center">Заявка не найдена.</div>
        </main>
        <Footer />
      </div>
    );
  }

  const offersForSelectedPosition = selectedPosition ? getOffersForPosition(selectedPosition.id) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 flex flex-col">
      <Header />
      {/* ---- Контейнер для уведомлений ---- */}
        <div className="fixed top-24 right-5 z-50 w-full max-w-sm space-y-3">
          {notifications.map(notif => (
            <Notification key={notif.id} {...notif} onDismiss={removeNotification} />
          ))}
        </div>
      <main className="flex-grow container mx-auto px-4 py-8">
        {/* -- Верхний блок -- */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-2xl font-bold text-gray-800">Заявка №{request.display_id}</h1>
            {getStatusBadge(request.status)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <InfoBlock label="Дата создания" value={new Date(request.created_at).toLocaleDateString('ru-RU')} />
            <InfoBlock label="Дедлайн" value={request.delivery_at ? new Date(request.delivery_at).toLocaleDateString('ru-RU') : 'Не указан'} />
            <InfoBlock label="Адрес доставки" value={request.delivery_address} />
            <InfoBlock label="Контрагент" value={request.counterparty?.short_name} />
          </div>
        </div>

        {/* -- Таблица позиций -- */}
        <div className="bg-white rounded-xl shadow-md overflow-x-auto mb-8">
          <h2 className="text-xl font-semibold p-6">Позиции заявки</h2>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">№</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Наименование</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Кол-во</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ед.</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Лучшее предложение</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Предложения</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {request.items.map((item, index) => {
                const bestOffer = getBestOffer(item.id);
                return (
                  <tr key={item.id} className={`${selectedPosition?.id === item.id ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">
                      <div>{item.name || item.category}</div>
                      <div className="text-xs text-gray-500">{item.dims || item.size}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.unit || item.uom || 'шт.'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {bestOffer ? (
                        <div>
                          <span className="font-semibold text-green-700">{bestOffer.price.toLocaleString('ru-RU')} ₽</span>
                          <span className="text-gray-500"> / {bestOffer.supplierName}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => setSelectedPosition(item)}
                        className="text-amber-600 hover:text-amber-800 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                        disabled={getOffersForPosition(item.id).length === 0}
                      >
                        Сравнить ({getOffersForPosition(item.id).length})
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* -- Панель предложений -- */}
        {selectedPosition && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Предложения по позиции: "{selectedPosition.name || selectedPosition.category}"</h2>
              <button onClick={() => setSelectedPosition(null)} className="text-gray-500 hover:text-gray-700">Закрыть</button>
            </div>
            
            {offersForSelectedPosition.length > 0 ? (
              <div className="space-y-4">
                {offersForSelectedPosition.map(offer => {
                  const offerItem = offer.items.find(i => i.request_item_id === selectedPosition.id);
                  if (!offerItem) return null;

                  const totalPrice = (selectedPosition.quantity || 0) * offerItem.price;

                  return (
                    <div key={offer.id} className="border border-gray-200 rounded-lg p-4 grid grid-cols-6 gap-4 items-center">
                      <div className="col-span-2 font-semibold">{offer.supplier.short_name}</div>
                      <div><span className="font-bold">{offerItem.price.toLocaleString('ru-RU')} ₽</span> / ед.</div>
                      <div><span className="text-gray-600">Итого:</span> {totalPrice.toLocaleString('ru-RU')} ₽</div>
                      <div className="col-span-2 flex justify-end items-center gap-2">
                        <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100" disabled={isSubmitting || request.status === 'awarded'}>Отклонить</button>
                        <button onClick={() => handleChooseOffer(offer.id)} className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50" disabled={isSubmitting || request.status === 'awarded'}>
                          {isSubmitting ? 'Выбор...' : 'Выбрать'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p>Предложений по этой позиции пока нет.</p>
            )}
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}
