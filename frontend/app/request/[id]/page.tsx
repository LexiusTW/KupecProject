'use client';

import { useEffect, useState, Fragment, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import Notification, { NotificationProps } from '@/app/components/Notification';
import AnalogModal, { AnalogueData } from '@/app/components/AnalogModal';

// Interfaces for data structures
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

interface OfferItemInput {
  request_item_id: number;
  price: string;
  total_price: string;
  is_analogue: boolean;
  // Analogue fields
  quantity?: string;
  unit?: string;
  name?: string;
  description?: string;
  category?: string;
  size?: string;
  stamp?: string;
  state_standard?: string;
}

// Reusable class names from account/page.tsx
const clsInput = 'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500';
const clsButton = 'px-5 py-2 bg-amber-600 text-white rounded-md font-semibold hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500';
const clsButtonSecondary = 'px-4 py-2 border border-gray-300 rounded-md';

export default function RequestPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string | undefined;
  const token = searchParams.get('token');

  const [requestData, setRequestData] = useState<RequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for the offer
  const [offerItems, setOfferItems] = useState<Record<number, OfferItemInput>>({});
  const [deliveryOption, setDeliveryOption] = useState('with_delivery');
  const [vatOption, setVatOption] = useState('with_vat');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceExpiresAt, setInvoiceExpiresAt] = useState('');
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [offerComment, setOfferComment] = useState('');

  // State for analogue modal
  const [isAnalogueModalOpen, setAnalogueModalOpen] = useState(false);
  const [currentItemForAnalogue, setCurrentItemForAnalogue] = useState<RequestItem | null>(null);

  // Notifications
  const [notifications, setNotifications] = useState<Omit<NotificationProps, 'onDismiss'>[]>([]);
  const addNotification = (notif: Omit<NotificationProps, 'id' | 'onDismiss'>) => {
    const nid = crypto.randomUUID();
    setNotifications(prev => [...prev, { id: nid, ...notif }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== nid)), 6000);
  };

  // Refs for styled file inputs
  const invoiceFileRef = useRef<HTMLInputElement>(null);
  const contractFileRef = useRef<HTMLInputElement>(null);

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
        const initialOfferItems: Record<number, OfferItemInput> = {};
        (data.items || []).forEach(item => {
          initialOfferItems[item.id] = {
            request_item_id: item.id,
            price: '',
            total_price: '',
            is_analogue: false,
          };
        });
        setOfferItems(initialOfferItems);
      })
      .catch(err => {
        console.error(err);
        setError(err.message || 'Не удалось загрузить заявку');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handlePriceChange = (itemId: number, value: string, field: 'price' | 'total_price') => {
    const item = requestData?.items.find(i => i.id === itemId);
    if (!item || !item.quantity) return;

    const cleanedValue = value.replace(/[^\d.,]/g, '').replace(',', '.');
    let newPrice = field === 'price' ? cleanedValue : offerItems[itemId].price;
    let newTotalPrice = field === 'total_price' ? cleanedValue : offerItems[itemId].total_price;

    if (field === 'price') {
      const priceNum = parseFloat(cleanedValue);
      newTotalPrice = !isNaN(priceNum) ? (priceNum * item.quantity).toFixed(2) : '';
    } else if (field === 'total_price') {
      const totalNum = parseFloat(cleanedValue);
      newPrice = !isNaN(totalNum) ? (totalNum / item.quantity).toFixed(2) : '';
    }

    setOfferItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], price: newPrice, total_price: newTotalPrice }
    }));
  };

  const handleOpenAnalogueModal = (item: RequestItem) => {
    setCurrentItemForAnalogue(item);
    setAnalogueModalOpen(true);
  };

  const handleSaveAnalogue = (analogueData: AnalogueData) => {
    if (!currentItemForAnalogue) return;
    setOfferItems(prev => ({
        ...prev,
        [currentItemForAnalogue.id]: {
            ...prev[currentItemForAnalogue.id],
            is_analogue: true,
            quantity: analogueData.quantity,
            unit: analogueData.unit,
            name: analogueData.name,
            description: analogueData.description,
            category: analogueData.category,
            size: analogueData.size,
            stamp: analogueData.stamp,
            state_standard: analogueData.state_standard,
        }
    }));
    setAnalogueModalOpen(false);
    setCurrentItemForAnalogue(null);
  };

  const handleSubmitOffer = async () => {
    if (!requestData || !id || !token) {
      addNotification({ type: 'error', title: 'Ошибка', message: 'Отсутствует токен или данные заявки.' });
      return;
    }

    if (!invoiceFile) {
      addNotification({ type: 'error', title: 'Ошибка валидации', message: 'Необходимо прикрепить счёт на оплату.' });
      return;
    }
    if (!invoiceExpiresAt) {
      addNotification({ type: 'error', title: 'Ошибка валидации', message: 'Укажите дату окончания действия счёта.' });
      return;
    }

    const payloadItems = Object.values(offerItems).map(item => ({
      ...item,
      price: parseFloat(item.price.replace(',', '.')) || 0,
      total_price: parseFloat(item.total_price.replace(',', '.')) || 0,
      quantity: item.is_analogue ? parseFloat(item.quantity || '0') : undefined,
    }));

    if (payloadItems.some(p => p.price <= 0)) {
      addNotification({ type: 'warning', title: 'Неполные цены', message: 'Укажите цену для всех позиций.' });
      return;
    }

    const offerDetails = {
      comment: offerComment,
      items: payloadItems,
      delivery_option: deliveryOption,
      vat_option: vatOption,
      invoice_expires_at: invoiceExpiresAt,
    };

    const formData = new FormData();
    formData.append('offer_data', JSON.stringify(offerDetails));
    formData.append('invoice_file', invoiceFile);
    if (contractFile) {
      formData.append('contract_file', contractFile);
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/v1/requests/${id}/offers?token=${token}`, {
        method: 'POST',
        body: formData,
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 flex flex-col">
      <Header showNav={false} />

      <div className="fixed top-24 right-5 z-50 w-full max-w-sm space-y-3">
        {notifications.map(n => (
          <Notification key={n.id} {...n} onDismiss={(id) => setNotifications(prev => prev.filter(x => x.id !== id))} />
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
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${requestData.status === 'Предложено' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {requestData.status || 'Новая'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700">Адрес доставки</h3>
                <p className="text-sm text-gray-600 mt-1">{requestData.delivery_address || '—'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700">Дата поставки</h3>
                <p className="text-sm text-gray-600 mt-1">{requestData.delivery_at ? `ДО ${new Date(requestData.delivery_at).toLocaleDateString()}` : '—'}</p>
              </div>
            </div>

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
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Цена за ед.</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Общая цена</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {requestData.items.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{item.kind === 'metal' ? 'Металлопрокат' : item.category || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.kind === 'metal' ? item.category : item.name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.kind === 'metal' ? item.size || '—' : item.dims || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.kind === 'metal' ? item.state_standard || '—' : '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.kind === 'metal' ? item.stamp || '—' : '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.allow_analogs ? (
                            <button onClick={() => handleOpenAnalogueModal(item)} className="text-amber-600 hover:text-amber-800 font-semibold text-xs">
                              {offerItems[item.id]?.is_analogue ? 'Ред. аналог' : 'Предложить'}
                            </button>
                          ) : 'Нет'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.quantity ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.unit ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.comment || '—'}</td>
                        <td className="px-4 py-3 text-sm">
                          <input type="text" inputMode="decimal" value={offerItems[item.id]?.price || ''} onChange={(e) => handlePriceChange(item.id, e.target.value, 'price')} placeholder="0.00" className={`${clsInput} w-28`} />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <input type="text" inputMode="decimal" value={offerItems[item.id]?.total_price || ''} onChange={(e) => handlePriceChange(item.id, e.target.value, 'total_price')} placeholder="0.00" className={`${clsInput} w-32`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Условия доставки</label>
                      <div className="flex gap-x-6">
                          <label className="flex items-center gap-2"><input type="radio" name="delivery" value="with_delivery" checked={deliveryOption === 'with_delivery'} onChange={(e) => setDeliveryOption(e.target.value)} className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300"/> С доставкой</label>
                          <label className="flex items-center gap-2"><input type="radio" name="delivery" value="without_delivery" checked={deliveryOption === 'without_delivery'} onChange={(e) => setDeliveryOption(e.target.value)} className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300"/> Без доставки</label>
                      </div>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">НДС</label>
                      <div className="flex gap-x-6">
                          <label className="flex items-center gap-2"><input type="radio" name="vat" value="with_vat" checked={vatOption === 'with_vat'} onChange={(e) => setVatOption(e.target.value)} className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300"/> С НДС</label>
                          <label className="flex items-center gap-2"><input type="radio" name="vat" value="without_vat" checked={vatOption === 'without_vat'} onChange={(e) => setVatOption(e.target.value)} className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300"/> Без НДС</label>
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Счёт на оплату*</label>
                      <div className="mt-1 flex items-center gap-3">
                          <button type="button" onClick={() => invoiceFileRef.current?.click()} className={clsButtonSecondary}>Выберите счёт</button>
                          <span className="text-sm text-gray-600 truncate">{invoiceFile?.name || 'Файл не выбран'}</span>
                          <input type="file" ref={invoiceFileRef} required onChange={(e) => setInvoiceFile(e.target.files ? e.target.files[0] : null)} className="hidden" />
                      </div>
                      <label htmlFor="invoiceExpiresAt" className="block text-sm font-medium text-gray-700 mt-4">Действует до</label>
                      <input id="invoiceExpiresAt" type="date" required value={invoiceExpiresAt} onChange={(e) => setInvoiceExpiresAt(e.target.value)} className={`${clsInput} mt-1`} />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Договор</label>
                      <div className="mt-1 flex items-center gap-3">
                          <button type="button" onClick={() => contractFileRef.current?.click()} className={clsButtonSecondary}>Выберите договор</button>
                          <span className="text-sm text-gray-600 truncate">{contractFile?.name || 'Файл не выбран'}</span>
                          <input type="file" ref={contractFileRef} onChange={(e) => setContractFile(e.target.files ? e.target.files[0] : null)} className="hidden" />
                      </div>
                  </div>
              </div>
              
              <div>
                  <label htmlFor="offerComment" className="block text-sm font-medium text-gray-700">Комментарий к предложению</label>
                  <textarea id="offerComment" value={offerComment} onChange={(e) => setOfferComment(e.target.value)} rows={3} className={`${clsInput} mt-1`}></textarea>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button onClick={handleSubmitOffer} className={clsButton}>
                Отправить предложение
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />

      <AnalogModal
        isOpen={isAnalogueModalOpen}
        onClose={() => setAnalogueModalOpen(false)}
        onSave={handleSaveAnalogue}
        item={currentItemForAnalogue}
        initialData={currentItemForAnalogue ? offerItems[currentItemForAnalogue.id] : {}}
      />
    </div>
  );
}