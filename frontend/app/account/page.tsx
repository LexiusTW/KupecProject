'use client';

import { useEffect, useState, ChangeEvent, useCallback, useMemo, useRef } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Link from 'next/link';
import SkeletonLoader from '../components/SkeletonLoader';
import Notification, { NotificationProps } from '../components/Notification';

const API_BASE_URL = 'https://ekbmetal.cloudpub.ru';
const clsInput = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500';
const clsInputError = 'w-full px-3 py-2 border border-red-500 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500';

/** ─────────── Типы ответа бэка (строго) ─────────── */
type RequestItemMetal = {
  id: number;
  kind: 'metal';
  category: string | null;
  state_standard: string | null;
  stamp: string | null;
  thickness: number | null;
  length: number | null;
  width: number | null;
  diameter: number | null;
  size: string | null;
  quantity: number | null;
  allow_analogs: boolean | null;
  comment: string | null;
};

type RequestItemGeneric = {
  id: number;
  kind: 'generic';
  category: string | null;
  name: string | null;
  dims: string | null;
  uom: string | null;
  note: string | null;
  quantity: number | null;
  comment: string | null;
};

type RequestItem = RequestItemMetal | RequestItemGeneric;

type RequestRow = {
  id: number;
  created_at: string;
  comment: string | null;
  delivery_address: string | null;
  delivery_at: string | null;
  items: RequestItem[];
  counterparty: {
    id: number;
    short_name: string;
  } | null;
};

type Supplier = {
  id: number;
  short_name: string;
  legal_address: string;
  ogrn?: string | null;
  inn: string;
  kpp?: string | null;
  okpo?: string | null;
  okato?: string | null;
  contact_person?: string | null; // ФИО контактного лица
  phone_number?: string | null;   // Телефон
  email?: string | null;          // Почта
};

// Типы для подсказок DaData (аналогично request/page.tsx)
type DaDataParty = {
  value: string;
  unrestricted_value: string;
  inn: string;
  kpp?: string;
  ogrn?: string;
  okpo?: string;
  okato?: string;
  short_name?: string;
  legal_address?: string;
};

type DaDataAddr = { value: string; unrestricted_value?: string };


type SupplierCreateForm = Partial<Omit<Supplier, 'id'>>;
type SupplierFormErrors = { [K in keyof SupplierCreateForm]?: string };

type Tab = 'requests' | 'suppliers';

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<Tab>('requests');

  // Состояние для уведомлений
  const [notifications, setNotifications] = useState<Omit<NotificationProps, 'onDismiss'>[]>([]);
  const addNotification = (notif: Omit<NotificationProps, 'id' | 'onDismiss'>) => {
    const id = crypto.randomUUID();
    setNotifications(prev => [...prev, { id, ...notif }]);
  };
  const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));

  // Состояния для заявок
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  // Состояния для поставщиков
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const [showSupplierCreateModal, setShowSupplierCreateModal] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState<SupplierCreateForm>({});
  const [supplierFormErrors, setSupplierFormErrors] = useState<SupplierFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Состояния для DaData поиска организаций
  const [dadataQuery, setDadataQuery] = useState('');
  const [dadataSugg, setDadataSugg] = useState<DaDataParty[]>([]);
  const [dadataFocus, setDadataFocus] = useState(false);
  const [dadataLoading, setDadataLoading] = useState(false);
  const dadataAbort = useRef<AbortController | null>(null);

  // Состояния для DaData подсказок адреса
  const [addrQuery, setAddrQuery] = useState('');
  const [addrSugg, setAddrSugg] = useState<DaDataAddr[]>([]);
  const [addrFocus, setAddrFocus] = useState(false);
  const [addrLoading, setAddrLoading] = useState(false);
  const addrAbort = useRef<AbortController | null>(null);

  const handleSupplierFormChange = (field: keyof SupplierCreateForm, value: string | ChangeEvent<HTMLInputElement>) => {
    const inputElement = typeof value !== 'string' ? value.target : null;
    const val = typeof value === 'string' ? value : inputElement?.value ?? '';

    if (supplierFormErrors[field]) setSupplierFormErrors(prev => ({ ...prev, [field]: undefined }));

    if (field === 'phone_number') {
      const input = inputElement;
      if (!input) return;

      let digits = input.value.replace(/\D/g, '');
      const matrix = "+7 (___) ___-__-__";

      // Если пользователь вводит 8, заменяем на 7. Если вводит 7, оставляем.
      // Если вводит что-то другое, считаем, что это код оператора и добавляем 7.
      if (digits.length > 0) {
        if (digits.startsWith('8')) digits = '7' + digits.slice(1);
        if (!digits.startsWith('7')) digits = '7' + digits;
      }

      let i = 0;
      let formattedValue = matrix.replace(/./g, (char) => {
        if (/[_\d]/.test(char) && i < digits.length) {
          return digits[i++];
        } else if (i >= digits.length) {
          return "";
        }
        return char;
      });

      // Устанавливаем курсор в конец
      const setCursorToEnd = () => {
        input.selectionStart = input.selectionEnd = formattedValue.length;
      };
      // Используем requestAnimationFrame для установки курсора после обновления DOM
      requestAnimationFrame(setCursorToEnd);

      setNewSupplierForm(p => ({ ...p, phone_number: formattedValue }));

    } else {
      setNewSupplierForm(p => ({ ...p, [field]: val }));
    }
  };

  const validateSupplierForm = useCallback(() => {
    const errors: SupplierFormErrors = {};
    if (!newSupplierForm.short_name || newSupplierForm.short_name.length < 2) errors.short_name = 'Обязательное поле';
    if (!newSupplierForm.legal_address || newSupplierForm.legal_address.length < 3) errors.legal_address = 'Обязательное поле';
    if (!newSupplierForm.inn) {
      errors.inn = 'Обязательное поле';
    } else if (!/^\d{10}(\d{2})?$/.test(newSupplierForm.inn)) {
      errors.inn = 'ИНН должен состоять из 10 или 12 цифр';
    }

    if (newSupplierForm.ogrn && !/^\d{13}(\d{2})?$/.test(newSupplierForm.ogrn)) errors.ogrn = '13 или 15 цифр';
    if (newSupplierForm.kpp && !/^\d{9}$/.test(newSupplierForm.kpp)) errors.kpp = '9 цифр';
    if (newSupplierForm.okpo && !/^\d{8}(\d{2})?$/.test(newSupplierForm.okpo)) errors.okpo = '8 или 10 цифр';
    if (newSupplierForm.okato && !/^\d{1,20}$/.test(newSupplierForm.okato)) errors.okato = 'Некорректный формат';

    setSupplierFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [newSupplierForm]);

  const handleCreateSupplier = async () => {
    if (!validateSupplierForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Очищаем номер телефона от маски перед отправкой
      const payload = { ...newSupplierForm };
      if (payload.phone_number) {
        payload.phone_number = payload.phone_number.replace(/\D/g, '');
      }

      const res = await fetch(`${API_BASE_URL}/api/v1/suppliers/my`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Не удалось создать поставщика');
      }
      const createdSupplier: Supplier = await res.json();
      setSuppliers(prev => [...prev, createdSupplier]);
      setShowSupplierCreateModal(false);
      setNewSupplierForm({});
      setSupplierFormErrors({});
      addNotification({ type: 'success', title: 'Поставщик добавлен' });
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Ошибка', message: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- DaData хелперы, обернутые в useCallback для стабильности ---
  const fetchPartySuggest = useCallback(async (q: string) => {
    dadataAbort.current?.abort();
    dadataAbort.current = new AbortController();
    setDadataLoading(true);
    try {
      const url = `${API_BASE_URL}/api/v1/suggest/party?q=${encodeURIComponent(q)}&count=5`;
      const r = await fetch(url, { credentials: 'include', signal: dadataAbort.current.signal });
      if (!r.ok) return [];
      const data = await r.json();
      return (data?.suggestions ?? []) as DaDataParty[];
    } catch {
      return [];
    } finally {
      setDadataLoading(false);
    }
  }, []); // Зависимости не нужны, так как dadataAbort - это ref

  const fetchAddrSuggest = useCallback(async (q: string) => {
    addrAbort.current?.abort();
    addrAbort.current = new AbortController();
    setAddrLoading(true);
    try {
      const url = `${API_BASE_URL}/api/v1/suggest/address?q=${encodeURIComponent(q)}&count=5`;
      const r = await fetch(url, { credentials: 'include', signal: addrAbort.current.signal });
      const data = await r.json();
      return (data?.suggestions ?? []).map((s: any) => ({ value: s.value, unrestricted_value: s.unrestricted_value })) as DaDataAddr[];
    } catch {
      return [];
    } finally {
      setAddrLoading(false);
    }
  }, []); // Зависимости не нужны, так как addrAbort - это ref

  const handlePickDadataParty = (party: DaDataParty) => {
    setNewSupplierForm({
      ...newSupplierForm, // сохраняем уже введенные контакты
      short_name: party.short_name || '',
      legal_address: party.legal_address || '',
      inn: party.inn || '',
      kpp: party.kpp || '',
      ogrn: party.ogrn || '',
      okpo: party.okpo || '',
      okato: party.okato || '',
    });
    setDadataSugg([]);
    setDadataQuery('');
    setSupplierFormErrors({});
  };

  const handlePickAddr = (val: string) => {
    handleSupplierFormChange('legal_address', val);
    setAddrQuery(val);
    setAddrSugg([]);
  };

  const resetSupplierModal = () => {
    setShowSupplierCreateModal(false);
    setNewSupplierForm({});
    setSupplierFormErrors({});
    setDadataQuery('');
    setDadataSugg([]);
    setAddrQuery('');
    setAddrSugg([]);
  };

  // --- Эффекты загрузки данных ---
  useEffect(() => {
    async function fetchRequests() {
      try {
        setRequestsLoading(true);
        setRequestsError(null);
        const response = await fetch(`${API_BASE_URL}/api/v1/requests/me`, {
          credentials: 'include',
        });
        if (!response.ok) {
          const er = await response.json().catch(() => ({}));
          throw new Error(er.detail || 'Не удалось загрузить заявки');
        }
        const data = (await response.json()) as RequestRow[];
        setRequests(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setRequestsError(e.message || 'Ошибка загрузки');
      } finally {
        setRequestsLoading(false);
      }
    }

    async function fetchSuppliers() {
      try {
        setSuppliersLoading(true);
        setSuppliersError(null);
        const response = await fetch(`${API_BASE_URL}/api/v1/suppliers/my`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Не удалось загрузить поставщиков');
        setSuppliers(await response.json());
      } catch (e: any) {
        setSuppliersError(e.message || 'Ошибка загрузки поставщиков');
      } finally {
        setSuppliersLoading(false);
      }
    }

    if (activeTab === 'requests') {
      fetchRequests();
    } else if (activeTab === 'suppliers') {
      fetchSuppliers();
    }
  }, [activeTab]);

  // --- Эффекты для подсказок DaData ---
  useEffect(() => {
    const qParty = dadataQuery.trim();
    if (dadataFocus && qParty.length >= 2) {
      const t = setTimeout(() => fetchPartySuggest(qParty).then(setDadataSugg), 300);
      return () => clearTimeout(t);
    } else if (!dadataFocus) {
      setDadataSugg([]);
    }
  }, [dadataQuery, dadataFocus, fetchPartySuggest]);

  useEffect(() => {
    const qAddr = addrQuery.trim();
    if (addrFocus && qAddr.length >= 3) {
      const t = setTimeout(() => fetchAddrSuggest(qAddr).then(setAddrSugg), 300);
      return () => clearTimeout(t);
    } else if (!addrFocus) {
      setAddrSugg([]);
    }
  }, [addrQuery, addrFocus, fetchAddrSuggest]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 flex flex-col">
      <Header />

      <main className="flex-grow">
        {/* ---- Контейнер для уведомлений ---- */}
        <div className="fixed top-24 right-5 z-50 w-full max-w-sm space-y-3">
          {notifications.map(notif => (
            <Notification key={notif.id} {...notif} onDismiss={removeNotification} />
          ))}
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Личный кабинет</h1>
          </div>

          {/* Вкладки */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('requests')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'requests'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Мои заявки
              </button>
              <button
                onClick={() => setActiveTab('suppliers')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'suppliers'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Мои поставщики
              </button>
            </nav>
          </div>

          {/* Контент вкладок */}
          <div>
            {activeTab === 'requests' && (
              <div>
                {requestsLoading && (
                  <div className="space-y-6">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="bg-white rounded-xl shadow p-6">
                        <SkeletonLoader className="h-24 w-full" />
                      </div>
                    ))}
                  </div>
                )}
                {!requestsLoading && requestsError && (
                  <div className="bg-white rounded-xl shadow p-6 text-red-600">{requestsError}</div>
                )}
                {!requestsLoading && !requestsError && requests.length === 0 && (
                  <div className="bg-white rounded-xl shadow p-6">
                    <p className="text-gray-700">У вас пока нет заявок.</p>
                    <Link href="/request" className="inline-block mt-4 border border-amber-600 text-amber-700 px-4 py-2 rounded-md hover:bg-amber-50">
                      Оставить первую заявку
                    </Link>
                  </div>
                )}
                {!requestsLoading && !requestsError && requests.length > 0 && (
                  <div className="space-y-6">
                    {requests.map((req) => (
                      <div key={req.id} className="bg-white rounded-xl shadow-md p-6">
                        {/* ... остальная разметка заявки ... */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm text-gray-500">№ заявки</div>
                            <div className="text-lg font-semibold">{req.id}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500">Создана</div>
                            <div className="text-lg font-semibold">
                              {req.created_at ? new Date(req.created_at).toLocaleString('ru-RU') : '—'}
                            </div>
                          </div>
                          <div className="min-w-[200px]">
                            <div className="text-sm text-gray-500">Адрес доставки</div>
                            <div className="text-gray-800">{req.delivery_address || 'не указан'}</div>
                          </div>
                          <div className="min-w-[200px]">
                            <div className="text-sm text-gray-500">Контрагент</div>
                            <div className="text-gray-800">{req.counterparty?.short_name || 'не указан'}</div>
                          </div>
                        </div>
                        <div className="mt-4 border-t pt-4">
                          <div className="text-sm text-gray-500 mb-2">Позиции</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {req.items.map((it) => (
                              <div key={it.id} className="rounded-lg border bg-gray-50 border-gray-200 p-3 text-sm space-y-1">
                                {it.kind === 'metal' ? (
                                  <>
                                    <div className="font-semibold">{it.category || 'Металл'}</div>
                                    {it.size && <div><span className="text-gray-500">Размер: </span>{it.size}</div>}
                                    {it.stamp && <div><span className="text-gray-500">Марка: </span>{it.stamp}</div>}
                                    {it.state_standard && <div><span className="text-gray-500">ГОСТ: </span>{it.state_standard}</div>}
                                    <div><span className="text-gray-500">Кол-во: </span>{it.quantity ?? '—'}</div>
                                    {it.comment && <div className="text-gray-500 pt-1 border-t mt-1">
                                      <span className="italic">{it.comment}</span>
                                    </div>}
                                  </>
                                ) : (
                                  <>
                                    <div className="font-semibold">{it.name || 'Прочее'}</div>
                                    {it.category && it.category !== 'Прочее' && <div><span className="text-gray-500">Категория: </span>{it.category}</div>}
                                    {it.dims && <div><span className="text-gray-500">Характеристики: </span>{it.dims}</div>}
                                    <div>
                                      <span className="text-gray-500">Кол-во: </span>
                                      {it.quantity ?? '—'} {it.uom && `(${it.uom})`}
                                    </div>
                                    {it.comment && <div className="text-gray-500 pt-1 border-t mt-1">
                                      <span className="italic">{it.comment}</span>
                                    </div>}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'suppliers' && (
              <div>
                <div className="flex justify-end mb-4">
                  <button onClick={() => setShowSupplierCreateModal(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-md whitespace-nowrap">
                    + Добавить поставщика
                  </button>
                </div>
                {suppliersLoading && <SkeletonLoader className="h-40 w-full" />}
                {!suppliersLoading && suppliersError && <div className="bg-white rounded-xl shadow p-6 text-red-600">{suppliersError}</div>}
                {!suppliersLoading && !suppliersError && suppliers.length === 0 && (
                  <div className="bg-white rounded-xl shadow p-6 text-center">
                    <p className="text-gray-700">У вас пока нет добавленных поставщиков.</p>
                  </div>
                )}
                {!suppliersLoading && !suppliersError && suppliers.length > 0 && (
                  <div className="bg-white rounded-xl shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Наименование</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ИНН/КПП</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Юр. адрес</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Контактное лицо</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Телефон</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Почта</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200 text-sm ">
                        {suppliers.map(s => (
                          <tr key={s.id}>
                            <td className="px-6 py-4 whitespace-nowrap font-medium">{s.short_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{s.inn}{s.kpp ? ` / ${s.kpp}` : ''}</td>
                            <td className="px-6 py-4">{s.legal_address}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{s.contact_person || '—'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{s.phone_number || '—'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{s.email || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Модальное окно создания поставщика */}
          {showSupplierCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl p-6 space-y-4 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-semibold">Новый поставщик</h3>

                {/* Поиск по DaData */}
                <div className="relative">
                  <label className="text-xs text-gray-600">Поиск для автозаполнения</label>
                  <input
                    className={clsInput}
                    placeholder="Введите ИНН, ОГРН или название организации"
                    value={dadataQuery}
                    onChange={e => setDadataQuery(e.target.value)}
                    onFocus={() => setDadataFocus(true)}
                    onBlur={() => setTimeout(() => setDadataFocus(false), 200)}
                  />
                  {dadataLoading && <div className="text-xs text-gray-500 mt-1">Поиск...</div>}
                  {dadataFocus && dadataSugg.length > 0 && (
                    <div className="absolute z-40 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
                      {dadataSugg.map((p, i) => (
                        <button type="button" key={i} onMouseDown={() => handlePickDadataParty(p)} className="block w-full text-left px-3 py-2 hover:bg-amber-50 text-sm">
                          <div className="font-semibold">{p.short_name || p.value}</div>
                          <div className="text-xs text-gray-600">ИНН: {p.inn}, {p.legal_address}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                  <h4 className="md:col-span-3 text-md font-semibold text-gray-800">Основные реквизиты</h4>
                  <div>
                    <label className="text-xs text-gray-600">Краткое наименование*</label>
                    <input className={supplierFormErrors.short_name ? clsInputError : clsInput} placeholder="ООО Ромашка" value={newSupplierForm.short_name || ''} onChange={e => handleSupplierFormChange('short_name', e.target.value)} />
                    {supplierFormErrors.short_name && <p className="text-xs text-red-600 mt-1">{supplierFormErrors.short_name}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <div className="relative">
                      <label className="text-xs text-gray-600">Юридический адрес*</label>
                      <input
                        className={supplierFormErrors.legal_address ? clsInputError : clsInput}
                        placeholder="Начните вводить юр. адрес..."
                        value={newSupplierForm.legal_address || ''}
                        onFocus={() => { setAddrFocus(true); setAddrQuery(newSupplierForm.legal_address || ''); }}
                        onBlur={() => setTimeout(() => setAddrFocus(false), 150)}
                        onChange={e => { handleSupplierFormChange('legal_address', e.target.value); setAddrQuery(e.target.value); }}
                      />
                      {supplierFormErrors.legal_address && <p className="text-xs text-red-600 mt-1">{supplierFormErrors.legal_address}</p>}
                      {addrFocus && addrSugg.length > 0 && (
                        <div className="absolute z-30 mt-1 w-full max-h-48 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
                          {addrSugg.map((s, i) => (
                            <button type="button" key={i} onMouseDown={() => handlePickAddr(s.unrestricted_value || s.value)} className="block w-full text-left px-3 py-2 hover:bg-amber-50 text-sm">
                              {s.unrestricted_value || s.value}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">ИНН*</label>
                    <input className={supplierFormErrors.inn ? clsInputError : clsInput} placeholder="10 или 12 цифр" value={newSupplierForm.inn || ''} onChange={e => handleSupplierFormChange('inn', e.target.value)} />
                    {supplierFormErrors.inn && <p className="text-xs text-red-600 mt-1">{supplierFormErrors.inn}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">ОГРН</label>
                    <input className={supplierFormErrors.ogrn ? clsInputError : clsInput} placeholder="13 или 15 цифр" value={newSupplierForm.ogrn || ''} onChange={e => handleSupplierFormChange('ogrn', e.target.value)} />
                    {supplierFormErrors.ogrn && <p className="text-xs text-red-600 mt-1">{supplierFormErrors.ogrn}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">КПП</label>
                    <input className={supplierFormErrors.kpp ? clsInputError : clsInput} placeholder="9 цифр" value={newSupplierForm.kpp || ''} onChange={e => handleSupplierFormChange('kpp', e.target.value)} />
                    {supplierFormErrors.kpp && <p className="text-xs text-red-600 mt-1">{supplierFormErrors.kpp}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">ОКПО</label>
                    <input className={supplierFormErrors.okpo ? clsInputError : clsInput} placeholder="8 или 10 цифр" value={newSupplierForm.okpo || ''} onChange={e => handleSupplierFormChange('okpo', e.target.value)} />
                    {supplierFormErrors.okpo && <p className="text-xs text-red-600 mt-1">{supplierFormErrors.okpo}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">ОКАТО/ОКТМО</label>
                    <input className={clsInput} value={newSupplierForm.okato || ''} onChange={e => handleSupplierFormChange('okato', e.target.value)} />
                  </div>
                  <div className="md:col-span-3 border-t pt-4">
                     <h4 className="text-md font-semibold text-gray-800 mb-2">Контактная информация</h4>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">ФИО контактного лица</label>
                    <input className={clsInput} placeholder="Иванов Иван Иванович" value={newSupplierForm.contact_person || ''} onChange={e => handleSupplierFormChange('contact_person', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Номер телефона</label>
                    <input type="tel" className={clsInput} placeholder="+7 (999) 123-45-67" value={newSupplierForm.phone_number || ''} onChange={e => handleSupplierFormChange('phone_number', e)} maxLength={18} />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-gray-600">Почта</label>
                    <input type="email" className={clsInput} placeholder="supplier@example.com" value={newSupplierForm.email || ''} onChange={e => handleSupplierFormChange('email', e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t">
                  <button onClick={handleCreateSupplier} disabled={isSubmitting} className="px-4 py-2 bg-emerald-600 text-white rounded-md disabled:opacity-50">
                    {isSubmitting ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button onClick={resetSupplierModal} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50">
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )};
