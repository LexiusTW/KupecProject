'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import StatusRoadmap from '@/app/components/StatusRoadmap';
import SelectedOffersTable from '@/app/components/SelectedOffersTable';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// ---------- Types ----------
type UserInComment = {
  id: number;
  employee_name: string;
};

type Comment = {
  id: number | string;
  text: string;
  created_at: string;
  user: UserInComment;
};

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
};

type DisplayRequestItem = RequestItem & { displayName: string | null };

type SelectedOffer = {
  id: number;
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

type RequestDetails = {
  id: string;
  display_id: number;
  created_at: string;
  status: string;
  delivery_address: string | null;
  items: RequestItem[];
  comments: Comment[];
  selected_offers?: SelectedOffer[];
};

type SupplierCol = {
  id: string;
  name: string;
  prices: Record<number, number | null>;
  deliveryIncluded: boolean;
  deliveryTime: string;
  vatIncluded: boolean;
  comment: string;
  companyType: 'end_user' | 'trading' | '';
  paymentType: 'immediate' | 'deferred' | 'installment' | 'partial_postpayment' | '';
};

type MeOut = {
    id: number;
    login: string;
    role: 'Директор' | 'РОП' | 'Менеджер' | 'Снабженец';
};

type Status = 'Заявка создана' | 'Поиск поставщиков' | 'Наценка' | 'КП отправлено' | 'Оплачено' | 'В доставке' | 'Сделка закрыта';


// ---------- Helpers ----------
const makeId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2, 9));

const formatMoney = (v?: number | null) =>
  v == null || Number.isNaN(v) ? '—' : `${v.toLocaleString('ru-RU')} ₽`;


// ---------- Main Page Component ----------
export default function RequestDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [request, setRequest] = useState<RequestDetails | null>(null);
  const [viewingStatus, setViewingStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [chat, setChat] = useState<Comment[]>([]);
  const [currentUser, setCurrentUser] = useState<MeOut | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectionStatus, setSelectionStatus] = useState<Record<string, boolean>>({});
  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
  const [isDocsDropdownOpen, setIsDocsDropdownOpen] = useState(false);

  const categorizedItems = useMemo(() => {
    if (!request?.items) return {};
    return request.items.reduce((acc, item) => {
      const category = item.kind === 'metal' ? 'Металлопрокат' : item.category;
      if (!category) return acc;

      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({
        ...item,
        displayName: item.kind === 'metal' ? item.category : item.name,
      });
      return acc;
    }, {} as Record<string, DisplayRequestItem[]>);
  }, [request]);

  const allPricesSelected = useMemo(() => {
    const categoryNames = Object.keys(categorizedItems);
    if (categoryNames.length === 0) return false;
    // The selectionStatus is updated by the child table component.
    // We check if a status is recorded for every category and if that status is `true`.
    return categoryNames.every(name => selectionStatus[name] === true);
  }, [categorizedItems, selectionStatus]);

  const handleSelectionChange = useCallback((categoryName: string, isComplete: boolean) => {
    setSelectionStatus(prev => ({ ...prev, [categoryName]: isComplete }));
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [userRes, requestRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/v1/users/me`, { credentials: 'include' }),
            fetch(`${API_BASE_URL}/api/v1/requests/${id}`, { credentials: 'include' })
        ]);

        if (!userRes.ok) throw new Error('Ошибка загрузки данных пользователя');
        const userData: MeOut = await userRes.json();
        setCurrentUser(userData);

        if (!requestRes.ok) throw new Error('Ошибка загрузки заявки');
        const requestData: RequestDetails = await requestRes.json();
        

        
        setRequest(requestData);
        setViewingStatus(requestData.status as Status);
        setChat(requestData.comments || []);

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const sendChat = async () => {
    if (!messageText.trim() || !id || !currentUser) return;

    const tempId = makeId();
    const newCommentOptimistic: Comment = {
        id: tempId,
        text: messageText.trim(),
        created_at: new Date().toISOString(),
        user: {
            id: currentUser.id,
            employee_name: currentUser.login
        }
    };

    setChat((prev) => [...prev, newCommentOptimistic]);
    setMessageText('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/requests/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: messageText.trim() }),
      });

      if (!response.ok) throw new Error('Не удалось отправить комментарий.');

      const savedComment: Comment = await response.json();
      setChat((prev) => prev.map(c => (c.id === tempId ? savedComment : c) ));

    } catch (error) {
      console.error(error);
      setChat((prev) => prev.filter(c => c.id !== tempId));
    }
  };

  const handleSupplierStatusChange = async (supplierName: string, newStatus: string) => {
    if (!request || !request.selected_offers) return;

    const offersToUpdate = request.selected_offers.filter(offer => offer.supplier_name === supplierName);
    if (offersToUpdate.length === 0) {
        console.warn(`No offers found for supplier: ${supplierName}`);
        return;
    }

    try {
        const updatePromises = offersToUpdate.map(offer =>
            fetch(`${API_BASE_URL}/api/v1/requests/${id}/selected-offers/${offer.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ supplier_status: newStatus }),
                credentials: 'include',
            }).then(async res => {
                if (!res.ok) {
                    const errorBody = await res.text();
                    console.error(`Failed to update offer ${offer.id}:`, res.status, errorBody);
                    throw new Error(`Failed to update offer ${offer.id}`);
                }
                return res.json();
            })
        );

        const updatedOffersResults = await Promise.all(updatePromises);

        const updatedOffersMap = new Map(updatedOffersResults.map(o => [o.id, o]));

        const newSelectedOffers = request.selected_offers.map(offer =>
            updatedOffersMap.has(offer.id) ? updatedOffersMap.get(offer.id)! : offer
        );

        const newRequest = { ...request, selected_offers: newSelectedOffers };
        setRequest(newRequest);

        const allPaid = newSelectedOffers.every(offer => offer.supplier_status === 'Оплачено');
        if (allPaid) {
            handleChangeStatus('Оплачено');
        }

        const allInDelivery = newSelectedOffers.every(offer => offer.supplier_status === 'В доставке' || offer.supplier_status === 'Готово к выгрузке');
        if (allInDelivery) {
            handleChangeStatus('В доставке');
        }

        const allFinished = newSelectedOffers.every(offer => offer.supplier_status === 'Завершено');
        if (allFinished) {
            handleChangeStatus('Сделка закрыта');
        }
    } catch (error) {
        console.error('Error updating supplier status:', error);
    }
  };

  const handleChangeStatus = async (newStatus: Status) => {
    if (!request || isSubmitting || (newStatus === 'Наценка' && !allPricesSelected)) return;

    setIsSubmitting(true);
    try {
        if (newStatus === 'Наценка') {
            const offersToSave = [];
            for (const categoryName of Object.keys(categorizedItems)) {
                const suppliersKey = `suppliers_data_${id}_${categoryName.replace(/\s+/g, '_')}`;
                const selectionKey = `selected_prices_${id}_${categoryName.replace(/\s+/g, '_')}`;

                const suppliersRaw = localStorage.getItem(suppliersKey);
                const selectionRaw = localStorage.getItem(selectionKey);

                if (suppliersRaw && selectionRaw) {
                    const suppliers: SupplierCol[] = JSON.parse(suppliersRaw);
                    const selection: Record<number, number> = JSON.parse(selectionRaw);
                    
                    for (const itemIdStr in selection) {
                        const itemId = parseInt(itemIdStr, 10);
                        const supplierColIndex = selection[itemId];
                        const supplier = suppliers[supplierColIndex];
                        const item = request.items.find(i => i.id === itemId);

                        if (supplier && item) {
                            offersToSave.push({
                                request_item_id: item.id,
                                supplier_name: supplier.name,
                                price: supplier.prices[item.id],
                                delivery_included: supplier.deliveryIncluded,
                                delivery_time: supplier.deliveryTime,
                                vat_included: supplier.vatIncluded,
                                comment: supplier.comment,
                                company_type: supplier.companyType,
                                payment_type: supplier.paymentType,
                            });
                        }
                    }
                }
            }

            const saveOffersRes = await fetch(`${API_BASE_URL}/api/v1/requests/${id}/select-offers`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ offers: offersToSave }),
            });

            if (!saveOffersRes.ok) {
                const err = await saveOffersRes.json().catch(() => ({}));
                throw new Error(err.detail || 'Не удалось сохранить выбранные предложения');
            }
        }

        const statusUpdateRes = await fetch(`${API_BASE_URL}/api/v1/requests/${id}/status`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });

        if (!statusUpdateRes.ok) {
            const err = await statusUpdateRes.json().catch(() => ({}));
            throw new Error(err.detail || 'Не удалось изменить статус');
        }

        const updatedRequest = await statusUpdateRes.json();
        setRequest(updatedRequest);
        setViewingStatus(updatedRequest.status as Status);

    } catch (e) {
        console.error(e);
        // You can show an error to the user here
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleGenerateCounterProposal = () => {
    console.log("Generating counter proposal...");
    // Add actual logic here
    setIsDocumentsModalOpen(false);
  };

  const handleGenerateInvoice = () => {
    console.log("Generating invoice...");
    // Add actual logic here
    setIsDocumentsModalOpen(false);
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto p-8"><div className="bg-white p-8 rounded shadow text-center">Загрузка...</div></main>
        <Footer />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-grow container mx-auto p-8"><div className="bg-white p-8 rounded shadow text-center">Заявка не найдена</div></main>
        <Footer />
      </div>
    );
  }

  const isSelectionPhase = viewingStatus === 'Поиск поставщиков';
  const isMarkupPhase = viewingStatus === 'Наценка';
  const isEditable = request?.status === 'Заявка создана' || request?.status === 'Поиск поставщиков';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 space-y-8">
        {/* Request Header */}
        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Заявка №{request.display_id}</h1>
                {isEditable && (
                  <Link href={`/request/${id}/edit`} title="Редактировать заявку">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500 hover:text-amber-600 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L17.5 2.5z" /></svg>
                  </Link>
                )}
              </div>
              <p className="text-gray-500 text-sm mt-1">Создана: {new Date(request.created_at).toLocaleDateString('ru-RU')}</p>
              <p className="text-gray-500 text-sm">Адрес доставки: {request.delivery_address || '—'}</p>
            </div>
            <div className="flex items-center gap-3">
                {request.status === 'Поиск поставщиков' && (
                    <>
                        <div className="relative">
                            <button
                                onClick={() => setIsDocsDropdownOpen(prev => !prev)}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md whitespace-nowrap"
                            >
                                Документы
                            </button>
                            {isDocsDropdownOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                                    <button
                                        onClick={() => { console.log('Запрос КП'); setIsDocsDropdownOpen(false); }}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        Запрос КП
                                    </button>
                                    <button
                                        onClick={() => { console.log('Счет на оплату'); setIsDocsDropdownOpen(false); }}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        Счет на оплату
                                    </button>
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={() => handleChangeStatus('Наценка')} 
                            disabled={!allPricesSelected || isSubmitting}
                            className="bg-green-600 text-white px-4 py-2 rounded-md whitespace-nowrap disabled:bg-gray-400 disabled:cursor-not-allowed"
                            title={!allPricesSelected ? 'Выберите по одному поставщику для каждой категории' : ''}
                        >
                            Перейти к наценке
                        </button>
                    </>
                )}
                 {request.status !== 'Поиск поставщиков' && request.status !== 'Заявка создана' && (
                    <div className="relative">
                        <button
                            onClick={() => setIsDocsDropdownOpen(prev => !prev)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md whitespace-nowrap"
                        >
                            Документы
                        </button>
                        {isDocsDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-10 border">
                                <button
                                    onClick={() => { handleGenerateCounterProposal(); setIsDocsDropdownOpen(false); }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    Сформировать запрос КП
                                </button>
                                <button
                                    onClick={() => { handleGenerateInvoice(); setIsDocsDropdownOpen(false); }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    Сформировать счет на оплату
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
          </div>
          
          {request.status && viewingStatus && (
            <StatusRoadmap 
              currentStatus={request.status as Status} 
              viewingStatus={viewingStatus}
              onSelectStatus={setViewingStatus} 
            />
          )}
        </div>

        {/* Content based on status */}
        {viewingStatus === 'Заявка создана' ? (
            <div className="space-y-8">
                {Object.entries(categorizedItems).map(([categoryName, items]) => (
                    <div key={categoryName} className="bg-white rounded-xl shadow-md p-4">
                        <h2 className="text-xl font-semibold mb-4">{categoryName}</h2>
                        <table className="min-w-full border border-gray-300 text-sm">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border p-2 text-left">№</th>
                                    <th className="border p-2 text-left">Наименование</th>
                                    <th className="border p-2 text-left">Кол-во</th>
                                    <th className="border p-2 text-left">Ед. изм.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={item.id} className="odd:bg-white even:bg-gray-50">
                                        <td className="border p-2">{index + 1}</td>
                                        <td className="border p-2">{item.displayName}</td>
                                        <td className="border p-2">{item.quantity}</td>
                                        <td className="border p-2">{item.unit || 'шт.'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
                <div className="flex justify-end mt-6">
                    <button
                        onClick={() => handleChangeStatus('Поиск поставщиков')}
                        disabled={isSubmitting}
                        className="bg-amber-600 text-white px-6 py-3 rounded-lg shadow hover:bg-amber-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Начать поиск поставщиков
                    </button>
                </div>
            </div>
        ) : isSelectionPhase ? (
            Object.entries(categorizedItems).map(([categoryName, items]) => (
              <RequestCategoryTable
                key={categoryName}
                categoryName={categoryName}
                items={items}
                isEditable={true}
                requestId={id}
                onSelectionChange={handleSelectionChange}
              />
            ))
        ) : isMarkupPhase ? (
            <MarkupView 
                request={request}
                isSubmitting={isSubmitting}
                onStatusChange={handleChangeStatus}
            />
        ) : (
            <SelectedOffersTable 
                items={request.items}
                selectedOffers={request.selected_offers || []} 
                onStatusChange={handleSupplierStatusChange}
            />
        )}

        {/* Chat */}
        <div className="bg-white rounded-xl shadow-md">
          <h3 className="font-semibold text-gray-800 p-4 border-b">Комментарии по заявке</h3>
          <div className="max-h-96 overflow-y-auto p-4 space-y-4">
            {chat.length === 0 && <div className="text-sm text-gray-500 text-center">Нет комментариев</div>}
            {chat.map((m) => {
                const isMe = m.user.id === currentUser?.id;
                const authorName = isMe ? 'Вы' : m.user.employee_name;
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className="flex flex-col" style={{ maxWidth: '75%' }}>
                      <div className={`rounded-xl p-3 ${isMe ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                        <p className="text-sm">{m.text}</p>
                      </div>
                      <div className={`text-xs text-gray-500 mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                        <span>{authorName}, </span>
                        <span>{new Date(m.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                )
            })}
          </div>
          <div className="p-4 border-t flex gap-2 items-center">
            <input
              className="flex-1 bg-gray-100 border-transparent rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Ваш комментарий..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            />
            <button onClick={sendChat} className="px-4 py-2 bg-amber-600 text-white rounded-full hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2">
              Отправить
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ---------- Markup View Component ----------
interface MarkupViewProps {
  request: RequestDetails;
  isSubmitting: boolean;
  onStatusChange: (newStatus: Status) => void;
}

const MarkupView: React.FC<MarkupViewProps> = ({ request, isSubmitting, onStatusChange }) => {
  const [markup, setMarkup] = useState<{ type: 'percentage' | 'fixed', value: number }>({ type: 'percentage', value: 10 }); // Default 10% markup

  // This is a simplified placeholder. 
  // In a real implementation, you would have more complex state management for per-item/per-supplier markups.

  return (
    <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Наценка</h2>
      
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold">Общая наценка на сделку</h3>
        <select 
          className="p-2 border rounded-md bg-white"
          value={markup.type}
          onChange={e => setMarkup(prev => ({ ...prev, type: e.target.value as 'percentage' | 'fixed' }))}
        >
          <option value="percentage">Процент (%)</option>
          {/* <option value="fixed">Фиксированная (₽)</option> */}
        </select>
        <input 
          type="number"
          className="p-2 border rounded-md w-24"
          value={markup.value}
          onChange={e => setMarkup(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
        />
      </div>

      {/* We reuse SelectedOffersTable and pass markup info to it */}
      <SelectedOffersTable 
        items={request.items}
        selectedOffers={request.selected_offers || []}
        onStatusChange={() => {}} // Status changes are not handled here
        isMarkupView={true}
        markup={markup}
      />

      <div className="flex justify-end mt-6">
        <button
          onClick={() => onStatusChange('КП отправлено')}
          disabled={isSubmitting}
          className="bg-green-600 text-white px-6 py-3 rounded-lg shadow hover:bg-green-700 transition-colors disabled:bg-gray-400"
        >
          Сформировать и отправить КП
        </button>
      </div>
    </div>
  );
};

// ---------- Category Table Component ----------
interface RequestCategoryTableProps {
  categoryName: string;
  items: DisplayRequestItem[];
  requestId: string;
  isEditable: boolean;
  onSelectionChange: (categoryName: string, isComplete: boolean) => void;
}

const RequestCategoryTable: React.FC<RequestCategoryTableProps> = ({ categoryName, items, requestId, isEditable, onSelectionChange }) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [suppliers, setSuppliers] = useState<SupplierCol[]>([]);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [selection, setSelection] = useState<{ start: { row: number; col: number }; end: { row: number; col: number } } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [fillSourceSelection, setFillSourceSelection] = useState<typeof selection | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: number; col: number } | null>(null);
  const [selectedPrices, setSelectedPrices] = useState<Record<number, number | null>>({});

  const storageKey = `suppliers_data_${requestId}_${categoryName.replace(/\s+/g, '_')}`;
  const selectionStorageKey = `selected_prices_${requestId}_${categoryName.replace(/\s+/g, '_')}`;

  useEffect(() => {
    const isComplete = items.length > 0 && items.every(item => selectedPrices[item.id] !== undefined && selectedPrices[item.id] !== null);
    onSelectionChange(categoryName, isComplete);
  }, [selectedPrices, items, categoryName, onSelectionChange]);

  // 1. Инициализация таблицы при загрузке `items`
  useEffect(() => {
    if (!items || items.length === 0) return;

    // Загружаем данные из кэша
    const cachedSuppliersRaw = localStorage.getItem(storageKey);
    const cachedSuppliers = cachedSuppliersRaw ? JSON.parse(cachedSuppliersRaw) : [];

    if (cachedSuppliers.length > 0) {
      // Если поставщики есть в кэше, обновляем их структуру под актуальные `items`
      const updatedSuppliers = cachedSuppliers.map((sup: SupplierCol) => ({
          ...sup,
          prices: {
            ...Object.fromEntries(items.map(i => [i.id, null])), // Создаем основу для всех items
            ...sup.prices, // Перезаписываем сохраненными ценами
          }
      }));
      setSuppliers(updatedSuppliers);
    } else {
      // Если в кэше пусто, создаем первого поставщика
      setSuppliers([{ 
          id: makeId(), name: 'Поставщик 1', prices: Object.fromEntries(items.map(i => [i.id, null])),
          deliveryIncluded: false, deliveryTime: '', vatIncluded: false, comment: '', companyType: '', paymentType: ''
      }]);
    }

    const cachedSelectionRaw = localStorage.getItem(selectionStorageKey);
    if (cachedSelectionRaw) {
        setSelectedPrices(JSON.parse(cachedSelectionRaw));
    } else {
        setSelectedPrices({});
    }
  }, [items, categoryName, requestId, storageKey, selectionStorageKey]);

  // 2. Сохранение данных в localStorage при их изменении
  useEffect(() => {
    if (suppliers.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(suppliers));
    }
    localStorage.setItem(selectionStorageKey, JSON.stringify(selectedPrices));
  }, [suppliers, storageKey, selectedPrices, selectionStorageKey]);

  const getSelectionRange = useCallback(() => {
    if (!selection) return null;
    const { start, end } = selection;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    return { minRow, maxRow, minCol, maxCol };
  }, [selection]);

  const clearSelection = useCallback(() => {
    const range = getSelectionRange();
    if (!range) return;

    setSuppliers(prev => {
      const newSuppliers = JSON.parse(JSON.stringify(prev));
      const { minRow, maxRow, minCol, maxCol } = range;

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const supplier = newSuppliers[c];
          if (!supplier) continue;

          if (r < items.length) {
            const item = items[r];
            supplier.prices[item.id] = null;
          } else {
            const fieldRow = r - items.length;
            if (fieldRow === 1) supplier.deliveryTime = '';
            else if (fieldRow === 6) supplier.comment = '';
          }
        }
      }
      return newSuppliers;
    });
  }, [getSelectionRange, items]);

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
    setIsFilling(false);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingCell) return;

    if ((e.key === 'Backspace' || e.key === 'Delete') && selection) {
        e.preventDefault();
        clearSelection();
        return;
    }

    if (activeCell) {
        if (e.key === 'F2') {
            e.preventDefault();
            setEditingCell(activeCell);
            return;
        }
        if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
            e.preventDefault();
            handleCellUpdate(activeCell.row, activeCell.col, e.key);
            setEditingCell(activeCell);
        }
    }
  };



  useEffect(() => {
    if (!isEditable) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(event.target as Node)) {
        setActiveCell(null);
        setEditingCell(null);
        setSelection(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isEditable]);

  useEffect(() => {
    const body = document.body;
    if (isFilling) body.style.userSelect = 'none';
    else body.style.userSelect = 'auto';
    return () => { body.style.userSelect = 'auto'; };
  }, [isFilling]);

  useEffect(() => {
    setActiveCell(null);
    setEditingCell(null);
    setSelection(null);
  }, [suppliers.length]);

  useEffect(() => {
    if (!isSelecting && !isFilling) return;
    const table = tableRef.current;
    if (!table) return;

    const scrollZone = 50, scrollSpeed = 10;
    let animationFrameId: number | null = null;
    let scrollDirection: 'left' | 'right' | null = null;

    const scrollLoop = () => {
      if (!scrollDirection) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        return;
      }
      table.scrollLeft += scrollDirection === 'left' ? -scrollSpeed : scrollSpeed;
      const { x, y } = mousePosRef.current;
      const element = document.elementFromPoint(x, y);
      if (element) {
        const cell = element.closest('td[data-row][data-col]');
        if (cell) {
          const row = parseInt(cell.getAttribute('data-row')!, 10);
          const col = parseInt(cell.getAttribute('data-col')!, 10);
          if (!isNaN(row) && !isNaN(col)) {
            setSelection((prev) => (prev ? { ...prev, end: { row, col } } : null));
          }
        }
      }
      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      const { left, right } = table.getBoundingClientRect();
      if (e.clientX < left + scrollZone) scrollDirection = 'left';
      else if (e.clientX > right - scrollZone) scrollDirection = 'right';
      else scrollDirection = null;
      if (scrollDirection && !animationFrameId) animationFrameId = requestAnimationFrame(scrollLoop);
    };

    const localHandleMouseUp = () => {
      scrollDirection = null;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', localHandleMouseUp);
      handleMouseUp();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', localHandleMouseUp);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', localHandleMouseUp);
    };
  }, [isSelecting, isFilling, handleMouseUp]);

  const getCellValue = useCallback((row: number, col: number) => {
    if (!items || !suppliers[col]) return '';
    const supplier = suppliers[col];
    if (row < items.length) {
      return supplier.prices[items[row].id];
    } else {
      const fieldRow = row - items.length;
      if (fieldRow === 1) return supplier.deliveryTime;
      if (fieldRow === 6) return supplier.comment;
    }
    return '';
  }, [items, suppliers]);



  const addSupplier = () => {
    setSuppliers((prev) => [
      ...prev,
      {
        id: makeId(),
        name: `Поставщик ${prev.length + 1}`,
        prices: Object.fromEntries((items || []).map((i) => [i.id, null])),
        deliveryIncluded: false,
        deliveryTime: '',
        vatIncluded: false,
        comment: '',
        companyType: '',
        paymentType: '',
      },
    ]);
  };

  const removeLastSupplier = () => setSuppliers((prev) => prev.slice(0, -1));
  const updateSupplier = (supplierId: string, changes: Partial<SupplierCol>) => setSuppliers((prev) => prev.map((s) => (s.id === supplierId ? { ...s, ...changes } : s)));
  const updatePrice = (supplierId: string, itemId: number, value: number | null) => setSuppliers((prev) => prev.map((s) => (s.id === supplierId ? { ...s, prices: { ...s.prices, [itemId]: value } } : s)));

  const calcTotal = (supplier: SupplierCol) => items.reduce((acc, item) => {
    const p = supplier.prices[item.id];
    return (p == null || !item.quantity) ? acc : acc + p * item.quantity;
  }, 0);

  const handleRangePaste = useCallback(async () => {
    if (!activeCell) return;

    try {
      const text = await navigator.clipboard.readText();
      const rows = text.split(/\r?\n/).filter((r) => r.trim() !== '');
      const grid = rows.map((r) => r.split(/\t|;/));

      setSuppliers((prev) => {
        const newSuppliers = JSON.parse(JSON.stringify(prev));
        grid.forEach((rowVals, ri) => {
          rowVals.forEach((val, ci) => {
            const targetRow = activeCell.row + ri;
            const targetCol = activeCell.col + ci;

            if (targetRow >= items.length + 7 || targetCol >= newSuppliers.length) return;

            const supplier = newSuppliers[targetCol];
            if (!supplier) return;

            if (targetRow < items.length) {
              const item = items[targetRow];
              const num = val.trim() === '' ? null : Number(val.replace(',', '.'));
              if (!Number.isNaN(num)) supplier.prices[item.id] = num;
            } else {
              const fieldRow = targetRow - items.length;
              if (fieldRow === 1) supplier.deliveryTime = val;
              else if (fieldRow === 6) supplier.comment = val;
            }
          });
        });
        return newSuppliers;
      });
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
    }
  }, [activeCell, items]);

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    handleRangePaste();
  };

  const handleCopy = (e: React.ClipboardEvent) => {
    e.preventDefault();
    handleRangeCopy();
  };

  const handleCut = (e: React.ClipboardEvent) => {
    e.preventDefault();
    handleRangeCut();
  };

  const handleRangeCopy = useCallback(() => {
    if (!selection || editingCell) return;
    const range = getSelectionRange();
    if (!range) return;

    const { minRow, maxRow, minCol, maxCol } = range;
    let copyText = '';
    for (let r = minRow; r <= maxRow; r++) {
      const rowValues: (string | number | null | undefined)[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        rowValues.push(getCellValue(r, c));
      }
      copyText += rowValues.join('\t');
      if (r < maxRow) copyText += '\n';
    }
    navigator.clipboard.writeText(copyText).catch(err => console.error('Could not copy text: ', err));
  }, [selection, editingCell, getSelectionRange, getCellValue]);

  const handleRangeCut = useCallback(() => {
    handleRangeCopy();
    clearSelection();
  }, [handleRangeCopy, clearSelection]);

  const handleMouseDown = (e: React.MouseEvent, row: number, col: number) => {
    if (!isEditable) return;
    if (e.button === 2) { // Right-click
      const range = getSelectionRange();
      if (range) {
        const { minRow, maxRow, minCol, maxCol } = range;
        if (row >= minRow && row <= maxRow && col >= minCol && col <= maxCol) {
          // Clicked inside selection, do nothing to prevent deselection
          return;
        }
      }
    }
    // Left-click or right-click outside selection
    setIsSelecting(true);
    setSelection({ start: { row, col }, end: { row, col } });
    setActiveCell({ row, col });
    containerRef.current?.focus();
  };

  const handleMouseOver = (row: number, col: number) => {
    if (!isEditable) return;
    if (isSelecting) setSelection((prev) => (prev ? { ...prev, end: { row, col } } : null));
    else if (isFilling && selection) setSelection((prev) => (prev ? { ...prev, end: { row, col } } : null));
  };

  const applyFill = useCallback(() => {
    if (!isEditable) return;
    const currentSelectionRange = getSelectionRange();
    if (!currentSelectionRange || !fillSourceSelection || !activeCell) {
      if (fillSourceSelection) setFillSourceSelection(null);
      return;
    }

    const sourceSelectionRange = {
      minRow: Math.min(fillSourceSelection.start.row, fillSourceSelection.end.row),
      maxRow: Math.max(fillSourceSelection.start.row, fillSourceSelection.end.row),
      minCol: Math.min(fillSourceSelection.start.col, fillSourceSelection.end.col),
      maxCol: Math.max(fillSourceSelection.start.col, fillSourceSelection.end.col),
    };

    const sourceValue = getCellValue(activeCell.row, activeCell.col);

    setSuppliers(prev => {
      const newSuppliers = JSON.parse(JSON.stringify(prev));
      const combinedMinRow = Math.min(sourceSelectionRange.minRow, currentSelectionRange.minRow);
      const combinedMaxRow = Math.max(sourceSelectionRange.maxRow, currentSelectionRange.maxRow);
      const combinedMinCol = Math.min(sourceSelectionRange.minCol, currentSelectionRange.minCol);
      const combinedMaxCol = Math.max(sourceSelectionRange.maxCol, currentSelectionRange.maxCol);

      for (let r = combinedMinRow; r <= combinedMaxRow; r++) {
        for (let c = combinedMinCol; c <= combinedMaxCol; c++) {
          const isInCurrent = r >= currentSelectionRange.minRow && r <= currentSelectionRange.maxRow && c >= currentSelectionRange.minCol && c <= currentSelectionRange.maxCol;
          const isInSource = r >= sourceSelectionRange.minRow && r <= sourceSelectionRange.maxRow && c >= sourceSelectionRange.minCol && c <= sourceSelectionRange.maxCol;
          const supplier = newSuppliers[c];
          if (!supplier) continue;

          const updateValue = (val: any) => {
            if (r < items.length) {
              const item = items[r];
              const num = val === '' || val == null ? null : Number(val);
              supplier.prices[item.id] = Number.isNaN(num) ? null : num;
            } else {
              const fieldRow = r - items.length;
              if (fieldRow === 1) supplier.deliveryTime = val;
              else if (fieldRow === 6) supplier.comment = val;
            }
          };

          if (isInCurrent && !isInSource) updateValue(sourceValue);
          else if (isInSource && !isInCurrent) updateValue('');
        }
      }
      return newSuppliers;
    });
    setFillSourceSelection(null);
  }, [isEditable, getSelectionRange, fillSourceSelection, activeCell, getCellValue, items]);

  useEffect(() => {
    if (!isFilling && fillSourceSelection) {
      applyFill();
    }
  }, [isFilling, fillSourceSelection, applyFill]);

  const handleDoubleClick = (row: number, col: number) => {
    if (!isEditable) return;
    setEditingCell({ row, col });
    setActiveCell({ row, col });
  };

  const handleCellUpdate = (row: number, col: number, value: any) => {
    const supplier = suppliers[col];
    if (row < items.length) {
      const item = items[row];
      const num = value === '' ? null : Number(value);
      updatePrice(supplier.id, item.id, Number.isNaN(num) ? null : num);
    }
    else {
      const fieldRow = row - items.length;
      const changes: Partial<SupplierCol> = {};
      if (fieldRow === 1) changes.deliveryTime = value;
      else if (fieldRow === 6) changes.comment = value;
      updateSupplier(supplier.id, changes);
    }
  };

  const getSelectionStyle = (): React.CSSProperties => {
    if (!selection || !tableRef.current) return { display: 'none' };
    const range = getSelectionRange()!;
    const startCell = tableRef.current.querySelector(`[data-row='${range.minRow}'][data-col='${range.minCol}']`) as HTMLElement;
    const endCell = tableRef.current.querySelector(`[data-row='${range.maxRow}'][data-col='${range.maxCol}']`) as HTMLElement;
    if (!startCell || !endCell) return { display: 'none' };

    const style: React.CSSProperties = {
      position: 'absolute',
      left: startCell.offsetLeft,
      top: startCell.offsetTop,
      width: (endCell.offsetLeft + endCell.offsetWidth) - startCell.offsetLeft,
      height: (endCell.offsetTop + endCell.offsetHeight) - startCell.offsetTop,
      pointerEvents: 'none',
      zIndex: 15,
    };
    if (!isFilling) style.border = '2px solid #F97316';
    return style;
  };

  const selectionStyle = getSelectionStyle();

  const handleContextMenu = (e: React.MouseEvent, row: number, col: number) => {
    if (!isEditable) return;
    e.preventDefault();
    const cell = e.currentTarget as HTMLElement;
    const tableContainer = tableRef.current;
    if (!tableContainer) return;

    // If right-clicking outside the current selection, start a new selection.
    const range = getSelectionRange();
    if (!range || !(row >= range.minRow && row <= range.maxRow && col >= range.minCol && col <= range.maxCol)) {
        handleMouseDown(e, row, col);
    }

    const cellRect = cell.getBoundingClientRect();
    const containerRect = tableContainer.getBoundingClientRect();

    const x = cellRect.left - containerRect.left + tableContainer.scrollLeft;
    const y = cellRect.top - containerRect.top + tableContainer.scrollTop + cellRect.height;

    setContextMenu({ x, y, row, col });
  };

  const handleSelectPrice = (row: number, col: number) => {
    const item = items[row];
    const supplier = suppliers[col];
    if (!item || !supplier) return;

    const price = supplier.prices[item.id];
    if (price === null || price === undefined) return;

    setSelectedPrices(prev => ({
      ...prev,
      [item.id]: col,
    }));
    setContextMenu(null);
  };

  const handleDeselectPrice = (row: number) => {
    const item = items[row];
    if (!item) return;

    setSelectedPrices(prev => {
      const newSelection = { ...prev };
      delete newSelection[item.id];
      return newSelection;
    });
    setContextMenu(null);
  };

  return (
    <div 
        ref={containerRef} 
        tabIndex={-1} 
        onPaste={handlePaste}
        onCopy={handleCopy}
        onCut={handleCut}
        className="bg-white rounded-xl shadow-md p-4 outline-none relative"
        onClick={() => contextMenu && setContextMenu(null)}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{categoryName}</h2>
        <div className="flex gap-2">
            <button
                onClick={removeLastSupplier}
                disabled={suppliers.length <= 1}
                className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                Удалить последнего
            </button>
            <button onClick={addSupplier} className="px-3 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                + Добавить поставщика
            </button>
        </div>
      </div>
      <div ref={tableRef} className="overflow-x-auto relative p-1">
        <div style={selectionStyle} className={isFilling ? 'selection-border-animated' : ''} />
        {selection && (
          <div
              className="absolute w-2 h-2 bg-orange-600 border border-white cursor-crosshair"
              style={{
                left: selectionStyle.left as number + (selectionStyle.width as number) - 4,
                top: selectionStyle.top as number + (selectionStyle.height as number) - 4,
                zIndex: 20,
                pointerEvents: 'auto'
              }}
              onMouseDown={() => { if (isEditable) {
                setIsFilling(true);
                setFillSourceSelection(selection);
              }}}
          />
        )}
        {contextMenu && (
            <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
                {(() => {
                    const { row, col } = contextMenu;
                    const item = items[row];
                    const supplier = suppliers[col];
                    const value = supplier?.prices[item?.id];
                    const isSelected = item && selectedPrices[item.id] === col;

                    const commonOptions = (
                        <>
                            <ContextMenuItem onClick={() => { handleRangeCut(); setContextMenu(null); }}>Вырезать</ContextMenuItem>
                            <ContextMenuItem onClick={() => { handleRangeCopy(); setContextMenu(null); }}>Копировать</ContextMenuItem>
                            <ContextMenuItem onClick={() => { handleRangePaste(); setContextMenu(null); }}>Вставить</ContextMenuItem>
                        </>
                    );

                    if (row >= items.length) { // Non-price cells
                        return commonOptions;
                    }

                    if (isSelected) {
                        return (
                            <>
                                <ContextMenuItem onClick={() => handleDeselectPrice(row)}>Отменить выбор</ContextMenuItem>
                                {commonOptions}
                            </>
                        );
                    }

                    if (value !== null && value !== undefined) {
                        return (
                            <>
                                <ContextMenuItem onClick={() => handleSelectPrice(row, col)}>Выбрать</ContextMenuItem>
                                {commonOptions}
                            </>
                        );
                    }

                    return commonOptions;
                })()}
            </ContextMenu>
        )}
        <table className="min-w-full border border-gray-300 text-sm select-none table-fixed">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2" style={{ width: '32px', minWidth: '32px' }}>№</th>
              <th className="border p-2" style={{ width: '192px', minWidth: '192px' }}>Наименование</th>
              <th className="border p-2" style={{ width: '80px', minWidth: '80px' }}>Кол-во</th>
              <th className="border p-2" style={{ width: '64px', minWidth: '64px' }}>Ед. изм.</th>
              {suppliers.map((s, colIndex) => (
                <th key={s.id} className="border p-0 relative whitespace-nowrap" style={{ width: '120px', minWidth: '120px' }}>
                  <EditableCell
                    value={s.name}
                    isEditing={editingCell?.row === -1 && editingCell?.col === colIndex}
                    onDoubleClick={() => setEditingCell({ row: -1, col: colIndex })}
                    onUpdate={(value) => updateSupplier(s.id, { name: value })}
                    onStopEditing={() => setEditingCell(null)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, rowIndex) => (
              <tr key={item.id} className="odd:bg-white even:bg-gray-50">
                <td className="border p-2">{rowIndex + 1}</td>
                <td className="border p-2">{item.displayName}</td>
                <td className="border p-2">{item.quantity}</td>
                <td className="border p-2">{item.unit || 'шт.'}</td>
                {suppliers.map((s, colIndex) => {
                  const val = s.prices[item.id];
                  const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                  const isSelected = selectedPrices[item.id] === colIndex;
                  return (
                    <td
                      key={s.id}
                      data-row={rowIndex}
                      data-col={colIndex}
                      className={`border p-0 relative ${isSelected ? 'bg-green-100' : ''}`}
                      onMouseDown={(e) => handleMouseDown(e, rowIndex, colIndex)}
                      onMouseOver={() => handleMouseOver(rowIndex, colIndex)}
                      onDoubleClick={() => handleDoubleClick(rowIndex, colIndex)}
                      onContextMenu={(e) => handleContextMenu(e, rowIndex, colIndex)}
                    >
                      <EditableCell
                        value={val}
                        isEditing={isEditing}
                        onUpdate={(value) => handleCellUpdate(rowIndex, colIndex, value)}
                        onStopEditing={() => setEditingCell(null)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Footer Rows */}
            <tr className="bg-gray-100">
              <td colSpan={4} className="border p-2 font-medium">Доставка включена?</td>
              {suppliers.map((s, colIndex) => (
                <td key={s.id} data-row={items.length} data-col={colIndex} className="border p-2 text-center cursor-pointer" onClick={() => { if (isEditable) updateSupplier(s.id, { deliveryIncluded: !s.deliveryIncluded }) } } onContextMenu={(e) => handleContextMenu(e, items.length, colIndex)}>
                  <input type="checkbox" readOnly checked={s.deliveryIncluded} className="pointer-events-none" />
                </td>
              ))}
            </tr>
            <tr>
              <td colSpan={4} className="border p-2 font-medium">Срок доставки</td>
              {suppliers.map((s, colIndex) => {
                const rowIndex = items.length + 1;
                return (
                  <td key={s.id} data-row={rowIndex} data-col={colIndex} className="border p-0 relative"
                      onMouseDown={(e) => handleMouseDown(e, rowIndex, colIndex)}
                      onMouseOver={() => handleMouseOver(rowIndex, colIndex)}
                      onDoubleClick={() => handleDoubleClick(rowIndex, colIndex)} 
                      onContextMenu={(e) => handleContextMenu(e, rowIndex, colIndex)}>
                     <EditableCell
                        value={s.deliveryTime}
                        isEditing={editingCell?.row === rowIndex && editingCell?.col === colIndex}
                        onUpdate={(value) => updateSupplier(s.id, { deliveryTime: value })}
                        onStopEditing={() => setEditingCell(null)}
                      />
                  </td>
                )
              })}
            </tr>
            {/* Тип компании */}
            <tr className="bg-gray-100">
              <td colSpan={4} className="border p-2 font-medium">Тип компании</td>
              {suppliers.map((s, colIndex) => (
                <td key={s.id} data-row={items.length + 2} data-col={colIndex} className="border p-0" onContextMenu={(e) => handleContextMenu(e, items.length + 2, colIndex)}>
                  <select
                    value={s.companyType}
                    onChange={(e) => updateSupplier(s.id, { companyType: e.target.value as any })}
                    className="w-full h-full p-2 bg-transparent border-0 outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Не выбрано</option>
                    <option value="end_user">Конечный потребитель</option>
                    <option value="trading">Торговая организация</option>
                  </select>
                </td>
              ))}
            </tr>
            {/* Тип платежа */}
            <tr>
              <td colSpan={4} className="border p-2 font-medium">Тип платежа</td>
              {suppliers.map((s, colIndex) => (
                <td key={s.id} data-row={items.length + 3} data-col={colIndex} className="border p-0" onContextMenu={(e) => handleContextMenu(e, items.length + 3, colIndex)}>
                  <select
                    value={s.paymentType}
                    onChange={(e) => updateSupplier(s.id, { paymentType: e.target.value as any })}
                    className="w-full h-full p-2 bg-transparent border-0 outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Не выбрано</option>
                    <option value="immediate">Сразу</option>
                    <option value="deferred">Отсрочка</option>
                    <option value="installment">Рассрочка</option>
                    <option value="partial_postpayment">Частичная постоплата</option>
                  </select>
                </td>
              ))}
            </tr>
            <tr className="bg-gray-100">
              <td colSpan={4} className="border p-2 font-medium">Включён ли НДС?</td>
              {suppliers.map((s, colIndex) => (
                <td key={s.id} data-row={items.length + 4} data-col={colIndex} className="border p-2 text-center cursor-pointer" onClick={() => { if (isEditable) updateSupplier(s.id, { vatIncluded: !s.vatIncluded }) } } onContextMenu={(e) => handleContextMenu(e, items.length + 4, colIndex)}>
                  <input type="checkbox" readOnly checked={s.vatIncluded} className="pointer-events-none" />
                </td>
              ))}
            </tr>
            <tr>
              <td colSpan={4} className="border p-2 font-medium">Общая стоимость</td>
              {suppliers.map((s) => (
                <td key={s.id} className="border p-2 font-semibold">{formatMoney(calcTotal(s))}</td>
              ))}
            </tr>
            <tr className="bg-gray-50">
              <td colSpan={4} className="border p-2 font-medium">Комментарий</td>
              {suppliers.map((s, colIndex) => {
                 const rowIndex = items.length + 6;
                 return (
                  <td key={s.id} data-row={rowIndex} data-col={colIndex} className="border p-0 relative"
                      onMouseDown={(e) => handleMouseDown(e, rowIndex, colIndex)}
                      onMouseOver={() => handleMouseOver(rowIndex, colIndex)}
                      onDoubleClick={() => handleDoubleClick(rowIndex, colIndex)} 
                      onContextMenu={(e) => handleContextMenu(e, rowIndex, colIndex)}>
                     <EditableCell
                        value={s.comment}
                        isEditing={editingCell?.row === rowIndex && editingCell?.col === colIndex}
                        onUpdate={(value) => updateSupplier(s.id, { comment: value })}
                        onStopEditing={() => setEditingCell(null)}
                        isTextarea
                      />
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};


// ---------- EditableCell Component ----------
interface EditableCellProps {
  value: string | number | null | undefined;
  isEditing: boolean;
  isTextarea?: boolean;
  placeholder?: string;
  onUpdate: (value: string) => void;
  onStopEditing: () => void;
  onDoubleClick?: () => void;
}

const EditableCell: React.FC<EditableCellProps> = ({ value, isEditing, isTextarea, placeholder, onUpdate, onStopEditing, onDoubleClick }) => {
  const [currentValue, setCurrentValue] = useState(value?.toString() || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setCurrentValue(value?.toString() || '');
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      const element = inputRef.current || textareaRef.current;
      if (element) {
        element.focus();
        element.select();
      }
    }
  }, [isEditing]);

  const handleBlur = () => {
    onUpdate(currentValue);
    onStopEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !isTextarea) {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setCurrentValue(value?.toString() || '');
      onStopEditing();
    }
  };

  if (isEditing) {
    return isTextarea ? (
      <textarea
        ref={textareaRef}
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="absolute inset-0 w-full h-full p-2 box-border border-2 border-orange-600 outline-none resize-none z-10"
      />
    ) : (
      <input
        ref={inputRef}
        type="text"
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="absolute inset-0 w-full h-full p-2 box-border border-2 border-orange-600 outline-none z-10"
      />
    );
  }

  return (
    <div className="w-full h-full p-2" onDoubleClick={onDoubleClick}>
      {(value != null && value !== '') ? String(value) : (
        <span className="text-gray-400 italic">{placeholder}</span>
      )}
    </div>
  );
};

// ---------- Context Menu Component ----------
type ContextMenuProps = {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
};

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, children }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white border border-gray-300 rounded-md shadow-lg py-1"
      style={{ top: y, left: x }}
    >
      {children}
    </div>
  );
};

const ContextMenuItem: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
  >
    {children}
  </button>
);