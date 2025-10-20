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
};

interface SelectedOffersTableProps {
  items: RequestItem[];
  selectedOffers: SelectedOffer[];
  onStatusChange: (supplierName: string, status: string) => void;
  isMarkupView?: boolean; // New prop to indicate if the table is in markup view
  markup?: { type: 'percentage' | 'fixed', value: number }; // New prop for markup data
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
  markup = { type: 'percentage', value: 0 },
}) => {
  const offersBySupplier = selectedOffers.reduce((acc, offer) => {
    if (!acc[offer.supplier_name]) {
      acc[offer.supplier_name] = [];
    }
    acc[offer.supplier_name].push(offer);
    return acc;
  }, {} as Record<string, SelectedOffer[]>);

  const getItemById = (id: number) => items.find(item => item.id === id);

  const calculatePriceWithMarkup = (price: number) => {
    if (!isMarkupView || !markup) return price;
    if (markup.type === 'percentage') {
      return price * (1 + markup.value / 100);
    }
    // In a real scenario, you might handle fixed markup differently, e.g., distribute it
    return price; 
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
            const markedUpPrice = calculatePriceWithMarkup(offer.price);
            return sum + (markedUpPrice * (item?.quantity || 0));
          }, 0);

          return (
            <div key={supplierName} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 p-4">
                <h3 className="font-bold text-lg text-gray-900">{supplierName}</h3>
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
                    {isMarkupView && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена с наценкой</th>}
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сумма</th>
                    {isMarkupView && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сумма с наценкой</th>}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {offers.map(offer => {
                    const item = getItemById(offer.request_item_id);
                    const priceWithMarkup = calculatePriceWithMarkup(offer.price);
                    return (
                      <tr key={offer.request_item_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{item?.displayName || item?.name || 'Неизвестно'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item?.quantity} {item?.unit}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatMoney(offer.price)}</td>
                        {isMarkupView && <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">{formatMoney(priceWithMarkup)}</td>}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">{formatMoney(offer.price * (item?.quantity || 0))}</td>
                        {isMarkupView && <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-bold">{formatMoney(priceWithMarkup * (item?.quantity || 0))}</td>}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                    <tr>
                        <td colSpan={isMarkupView ? 2 : 2} className="px-6 py-3 text-right text-sm font-bold text-gray-800">Итого:</td>
                        <td className="px-6 py-3 text-left text-sm font-bold text-gray-900">{formatMoney(total)}</td>
                        {isMarkupView && <td className="px-6 py-3 text-left text-sm font-bold text-blue-700">{formatMoney(totalWithMarkup)}</td>}
                        {isMarkupView && <td colSpan={2}></td>} 
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
