'use client';

import React from 'react';

// These types should ideally be shared from the page, but are duplicated here for clarity
type RequestItem = {
  id: number;
  kind: string;
  name: string | null;
  category: string | null;
  dims: string | null;
  size: string | null;
  stamp: string | null;
  state_standard: string | null;
  quantity: number | null;
  unit: string | null;
  displayName?: string;
};

type SelectedOffer = {
  request_item_id: number;
  supplier_name: string;
  price: number;
  delivery_included: boolean;
  delivery_time: string;
  vat_included: boolean;
  comment: string;
  company_type: 'end_user' | 'trading' | '';
  payment_type: 'immediate' | 'deferred' | 'installment' | 'partial_postpayment' | '';
  supplier_status: string;
  markup?: number;
};

type Markups = {
  global: { type: 'percentage' | 'fixed', value: number };
  suppliers: Record<string, { type: 'percentage' | 'fixed', value: number }>;
  items: Record<number, number>;
};

interface SelectedOffersTableProps {
  items: RequestItem[];
  selectedOffers: SelectedOffer[];
  onStatusChange: (supplierName: string, status: string) => void;
  isMarkupView?: boolean;
  markups?: Markups;
  onMarkupsChange?: React.Dispatch<React.SetStateAction<Markups>>;
}

const formatMoney = (v?: number | null) =>
  v == null || Number.isNaN(v) ? '—' : `${v.toLocaleString('ru-RU')} ₽`;

const paymentTypeMap = {
    immediate: 'Сразу',
    deferred: 'Отсрочка',
    installment: 'Рассрочка',
    partial_postpayment: 'Частичная постоплата',
    '': '—',
};

const SelectedOffersTable: React.FC<SelectedOffersTableProps> = ({ 
  items, 
  selectedOffers, 
  onStatusChange, 
  isMarkupView = false,
  markups,
  onMarkupsChange,
}) => {
  const offersBySupplier = selectedOffers.reduce((acc, offer) => {
    if (!acc[offer.supplier_name]) {
      acc[offer.supplier_name] = [];
    }
    acc[offer.supplier_name].push(offer);
    return acc;
  }, {} as Record<string, SelectedOffer[]>);

  const getItemById = (id: number) => items.find(item => item.id === id);

  const calculatePriceWithMarkup = (price: number, itemId: number, supplierName: string) => {
    if (!isMarkupView || !markups) {
        const offer = selectedOffers.find(o => o.request_item_id === itemId && o.supplier_name === supplierName);
        return price + (offer?.markup || 0);
    }

    const itemMarkup = markups.items[itemId];
    if (itemMarkup !== undefined && itemMarkup !== null && itemMarkup > 0) {
      return price + itemMarkup;
    }

    const supplierMarkup = markups.suppliers[supplierName];
    if (supplierMarkup && supplierMarkup.value > 0) {
      if (supplierMarkup.type === 'percentage') {
        return price * (1 + supplierMarkup.value / 100);
      }
      return price + supplierMarkup.value;
    }

    if (markups.global.type === 'percentage' && markups.global.value > 0) {
      return price * (1 + markups.global.value / 100);
    }
    
    return price;
  };

  const handleMarkupChange = (
    key: 'items' | 'suppliers',
    identifier: number | string,
    value: any
) => {
    if (!onMarkupsChange) return;

    onMarkupsChange(prev => {
        if (key === 'items') {
            return {
                ...prev,
                items: {
                    ...prev.items,
                    [identifier]: value,
                },
            };
        }
        if (key === 'suppliers') {
            const supplierName = identifier as string;
            return {
                ...prev,
                suppliers: {
                    ...prev.suppliers,
                    [supplierName]: {
                        ...(prev.suppliers?.[supplierName] || { type: 'percentage', value: 0 }),
                        ...value,
                    },
                },
            };
        }
        return prev;
    });
};


  return (
    <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">
        {isMarkupView ? 'Предложения для наценки' : 'Выбранные предложения'}
      </h2>
      {Object.keys(offersBySupplier).length === 0 ? (
        <p className="text-gray-500">Нет выбранных предложений.</p>
      ) : (
        Object.entries(offersBySupplier).map(([supplierName, offers]) => {
          const firstOffer = offers[0];
          
          const total = offers.reduce((sum, offer) => {
              const item = getItemById(offer.request_item_id);
              return sum + (offer.price * (item?.quantity || 0));
          }, 0);

          const totalWithMarkup = offers.reduce((sum, offer) => {
            const item = getItemById(offer.request_item_id);
            const markedUpPrice = calculatePriceWithMarkup(offer.price, offer.request_item_id, supplierName);
            return sum + (markedUpPrice * (item?.quantity || 0));
          }, 0);
          
          const finalTotal = (markups && markups.global.type === 'fixed' && markups.global.value > 0) 
            ? totalWithMarkup + markups.global.value
            : totalWithMarkup;

          return (
            <div key={supplierName} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 p-4">
                <h3 className="font-bold text-lg text-gray-900">{supplierName}</h3>
                {isMarkupView && onMarkupsChange && (
                  <div className="flex items-center gap-2 mt-2">
                    <h4 className="text-sm font-semibold">Наценка на поставщика:</h4>
                    <select 
                      className="p-1 border rounded-md bg-white text-sm"
                      value={markups?.suppliers[supplierName]?.type || 'percentage'}
                      onChange={e => handleMarkupChange('suppliers', supplierName, { type: e.target.value as 'percentage' | 'fixed' })}
                    >
                      <option value="percentage">%</option>
                      <option value="fixed">₽</option>
                    </select>
                    <input 
                      type="number"
                      className="p-1 border rounded-md w-20 text-sm"
                      value={markups?.suppliers[supplierName]?.value || ''}
                      onChange={e => handleMarkupChange('suppliers', supplierName, { value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm mt-2 text-gray-600">
                    <p><span className="font-medium">Доставка:</span> {firstOffer.delivery_included ? 'Включена' : 'Не включена'}</p>
                    <p><span className="font-medium">Срок:</span> {firstOffer.delivery_time || '—'}</p>
                    <p><span className="font-medium">НДС:</span> {firstOffer.vat_included ? 'Включен' : 'Не включен'}</p>
                    <p><span className="font-medium">Тип компании:</span> {firstOffer.company_type === 'end_user' ? 'Конечник' : firstOffer.company_type === 'trading' ? 'Торговая' : '—'}</p>
                    <p><span className="font-medium">Оплата:</span> {paymentTypeMap[firstOffer.payment_type] || '—'}</p>
                    {firstOffer.comment && <p className="col-span-2"><span className="font-medium">Комментарий:</span> {firstOffer.comment}</p>}
                </div>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наименование</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Кол-во</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена за ед.</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наценка, ₽</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена с наценкой</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сумма</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сумма с наценкой</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {offers.map(offer => {
                    const item = getItemById(offer.request_item_id);
                    const priceWithMarkup = calculatePriceWithMarkup(offer.price, offer.request_item_id, supplierName);
                    const markupValue = priceWithMarkup - offer.price;

                    return (
                      <tr key={offer.request_item_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{item?.displayName || item?.name || 'Неизвестно'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item?.quantity} {item?.unit}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatMoney(offer.price)}</td>
                        
                        {isMarkupView && onMarkupsChange ? (
                            <td className="px-6 py-4 whitespace-nowrap">
                                <input 
                                    type="number"
                                    className="p-1 border rounded-md w-20 text-sm"
                                    placeholder="₽"
                                    value={markups?.items[offer.request_item_id] || ''}
                                    onChange={e => handleMarkupChange('items', offer.request_item_id, parseFloat(e.target.value) || 0)}
                                />
                            </td>
                        ) : (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatMoney(markupValue)}</td>
                        )}

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">{formatMoney(priceWithMarkup)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">{formatMoney(offer.price * (item?.quantity || 0))}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-bold">{formatMoney(priceWithMarkup * (item?.quantity || 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                    <tr>
                        <td colSpan={5} className="px-6 py-3 text-right text-sm font-bold text-gray-800">Итого:</td>
                        <td className="px-6 py-3 text-left text-sm font-bold text-gray-900">{formatMoney(total)}</td>
                        <td className="px-6 py-3 text-left text-sm font-bold text-blue-700">{formatMoney(finalTotal)}</td>
                    </tr>
                </tfoot>
              </table>
              {!isMarkupView && (
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end space-x-4">
                  <p className="text-sm text-gray-600">Статус: <span className="font-semibold">{firstOffer.supplier_status}</span></p>
                  {firstOffer.supplier_status === 'В работе' && (
                      <button onClick={() => onStatusChange(supplierName, 'Оплачено')} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Оплачено</button>
                  )}
                  {firstOffer.supplier_status === 'Оплачено' && (
                      <p className="px-4 py-2 text-sm font-medium text-green-600 bg-green-100 rounded-md">✓ Оплачено</p>
                  )}
                  {firstOffer.supplier_status === 'Оплачено' && (
                      <button onClick={() => onStatusChange(supplierName, firstOffer.delivery_included ? 'В доставке' : 'Готово к выгрузке')} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">{firstOffer.delivery_included ? 'В доставке' : 'Готово к выгрузке'}</button>
                  )}
                  {(firstOffer.supplier_status === 'В доставке' || firstOffer.supplier_status === 'Готово к выгрузке') && (
                      <button onClick={() => onStatusChange(supplierName, 'Завершено')} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Завершить</button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default SelectedOffersTable;