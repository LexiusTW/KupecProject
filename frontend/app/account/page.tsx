'use client';

import { useEffect, useState, ChangeEvent, useCallback, useMemo, useRef } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Link from 'next/link';
import SkeletonLoader from '../components/SkeletonLoader';
import Notification, { NotificationProps } from '../components/Notification';

const API_BASE_URL = 'https://kupecbek.cloudpub.ru';
const clsInput = 'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500';
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
  id: string; // UUID
  display_id: number;
  created_at: string;
  comment: string | null;
  delivery_address: string | null;
  delivery_at: string | null;
  status: string;
  items: RequestItem[];
  offers: any[];
  counterparty: {
    id: number;
    short_name: string;
    inn: string;
  } | null;
};

type Supplier = {
  id: number;
  short_name: string;
  legal_address: string;
  ogrn?: string;
  inn: string;
  kpp?: string;
  okpo?: string;
  okato?: string;
  contact_person: string; // ФИО контактного лица
  phone_number: string;   // Телефон
  email: string;          // Почта
  category: string;       // Категория поставщика (именительный падеж)
};

type Counterparty = {
  id: number;
  short_name: string;
  legal_address: string;
  inn: string;
  kpp?: string;
  ogrn?: string;
  okpo?: string;
  okato?: string;
  bank_account?: string;
  bank_name?: string;
  bank_bik?: string;
  bank_corr?: string;
  // Новые поля
  contact_person?: string;
  phone?: string;
  email?: string;
};

type CounterpartyCreateForm = Partial<Omit<Counterparty, 'id'>>;
type CounterpartyFormErrors = { [K in keyof CounterpartyCreateForm]?: string };


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

type Tab = 'requests' | 'suppliers' | 'counterparties';

// --- Компонент для отображения списка заявок ---
const RequestsList = () => {
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: keyof RequestRow | 'offerCount', order: 'asc' | 'desc' }>({ key: 'created_at', order: 'desc' });
  const [filters, setFilters] = useState({
    date: '',
    status: '',
    counterparty: '',
    offerCount: '',
  });

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
    fetchRequests();
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSort = (key: keyof RequestRow | 'offerCount') => {
    setSort(prev => ({
      key,
      order: prev.key === key && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIndicator = (key: string) => {
    if (sort.key !== key) return null;
    return sort.order === 'asc' ? ' ▲' : ' ▼';
  };

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

  const filteredAndSortedRequests = useMemo(() => {
    return requests
      .filter(req => {
        const dateMatch = filters.date ? new Date(req.created_at).toISOString().split('T')[0] === filters.date : true;
        const statusMatch = filters.status ? req.status === filters.status : true;
        const cpMatch = filters.counterparty ? 
          (req.counterparty?.short_name.toLowerCase().includes(filters.counterparty.toLowerCase()) ||
          req.counterparty?.inn.includes(filters.counterparty)) : true;
        const offerMatch = filters.offerCount ? (req.offers?.length || 0) === parseInt(filters.offerCount) : true;
        return statusMatch && cpMatch && dateMatch && offerMatch;
      })
      .sort((a, b) => {
        let aValue: any, bValue: any;

        if (sort.key === 'offerCount') {
          aValue = a.offers?.length || 0;
          bValue = b.offers?.length || 0;
        } else if (sort.key === 'counterparty') {
          aValue = a.counterparty?.short_name || '';
          bValue = b.counterparty?.short_name || '';
        } else {
          aValue = a[sort.key as keyof RequestRow];
          bValue = b[sort.key as keyof RequestRow];
        }

        if (aValue < bValue) return sort.order === 'asc' ? -1 : 1;
        if (aValue > bValue) return sort.order === 'asc' ? 1 : -1;
        return 0;
      });
  }, [requests, filters, sort]);

  if (requestsLoading) {
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <SkeletonLoader className="h-40 w-full" />
      </div>
    )
  }

  if (requestsError) {
    return <div className="bg-white rounded-xl shadow p-6 text-red-600">{requestsError}</div>
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-6 text-center">
        <p className="text-gray-700">У вас пока нет заявок.</p>
        <Link href="/request" className="inline-block mt-4 border border-amber-600 text-amber-700 px-4 py-2 rounded-md hover:bg-amber-50">
          Оставить первую заявку
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Фильтры */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700">Дата</label>
            <input type="date" id="date-filter" name="date" value={filters.date} onChange={handleFilterChange} className={clsInput} />
          </div>
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700">Статус</label>
            <select id="status-filter" name="status" value={filters.status} onChange={handleFilterChange} className={clsInput}>
              <option value="">Все</option>
              <option value="new">Новая</option>
              <option value="pending">Ожидает</option>
              <option value="awarded">В работе</option>
              <option value="closed">Закрыта</option>
            </select>
          </div>
          <div>
            <label htmlFor="counterparty-filter" className="block text-sm font-medium text-gray-700">Контрагент</label>
            <input type="text" id="counterparty-filter" name="counterparty" value={filters.counterparty} onChange={handleFilterChange} placeholder="Название или ИНН" className={clsInput} />
          </div>
          <div>
            <label htmlFor="offers-filter" className="block text-sm font-medium text-gray-700">Кол-во предложений</label>
            <input type="number" id="offers-filter" name="offerCount" value={filters.offerCount} onChange={handleFilterChange} className={clsInput} />
          </div>
        </div>
      </div>

      {/* Таблица заявок */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('display_id')}>
                № заявки{getSortIndicator('display_id')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('created_at')}>
                Дата создания{getSortIndicator('created_at')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('status')}>
                Статус{getSortIndicator('status')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('offerCount')}>
                Предложения{getSortIndicator('offerCount')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Адрес доставки
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('counterparty')}>
                Контрагент{getSortIndicator('counterparty')}
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Позиции
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Открыть</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedRequests.map((request) => (
              <tr key={request.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{request.display_id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(request.created_at).toLocaleDateString('ru-RU')}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(request.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{request.offers?.length || 0}</td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={request.delivery_address || ''}>{request.delivery_address}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {request.counterparty ? (
                    <div>
                      <div>{request.counterparty.short_name}</div>
                      <div className="text-xs text-gray-400">ИНН: {request.counterparty.inn}</div>
                    </div>
                  ) : '—'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <div className="truncate w-48" title={request.items.map(it => it.kind === 'metal' ? it.category : it.name).join(', ')}>
                    {request.items.map(it => it.kind === 'metal' ? it.category : it.name).join(', ')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link href={`/account/requests/${request.id}`} className="text-amber-600 hover:text-amber-900">
                    Открыть
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<Tab>('requests');

  // Состояние для уведомлений
  const [notifications, setNotifications] = useState<Omit<NotificationProps, 'onDismiss'>[]>([]);
  const addNotification = (notif: Omit<NotificationProps, 'id' | 'onDismiss'>) => {
    const id = crypto.randomUUID();
    setNotifications(prev => [...prev, { id, ...notif }]);
  };
  const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));

  // Состояния для поставщиков
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const [showSupplierCreateModal, setShowSupplierCreateModal] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState<SupplierCreateForm>({});
  const [supplierFormErrors, setSupplierFormErrors] = useState<SupplierFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Режим редактирования: id редактируемого поставщика или null для создания
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  
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

  // Состояния для контрагентов
  const [cpsLoading, setCpsLoading] = useState(true);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [cpsError, setCpsError] = useState<string | null>(null);
  const [showCpModal, setShowCpModal] = useState(false);
  const [cpForm, setCpForm] = useState<CounterpartyCreateForm>({});
  const [cpFormErrors, setCpFormErrors] = useState<CounterpartyFormErrors>({});
  const [editingCpId, setEditingCpId] = useState<number | null>(null);
  const [isCpSubmitting, setIsCpSubmitting] = useState(false);

  // Состояния для DaData поиска организаций (для контрагентов)
  const [cpDadataQuery, setCpDadataQuery] = useState('');
  const [cpDadataSugg, setCpDadataSugg] = useState<DaDataParty[]>([]);
  const [cpDadataFocus, setCpDadataFocus] = useState(false);
  const [cpDadataLoading, setCpDadataLoading] = useState(false);
  const cpDadataAbort = useRef<AbortController | null>(null);

  // Состояния для DaData подсказок адреса (для контрагентов)
  const [cpAddrQuery, setCpAddrQuery] = useState('');
  const [cpAddrSugg, setCpAddrSugg] = useState<DaDataAddr[]>([]);
  const [cpAddrFocus, setCpAddrFocus] = useState(false);
  const [cpAddrLoading, setCpAddrLoading] = useState(false);
  const cpAddrAbort = useRef<AbortController | null>(null);


  const handleSupplierFormChange = (field: keyof SupplierCreateForm, value: string | ChangeEvent<HTMLInputElement>) => {
    const inputElement = typeof value !== 'string' ? value.target : null;
    const val = typeof value === 'string' ? value : inputElement?.value ?? '';

    if (supplierFormErrors[field]) {
      setSupplierFormErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }

    if (field === 'phone_number') {
      const input = inputElement;
      if (!input) {
        setNewSupplierForm(p => ({ ...p, phone_number: val }));
        return;
      }

      let digits = input.value.replace(/\D/g, '');
      const matrix = "+7 (___) ___-__-__";

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

      const setCursorToEnd = () => {
        input.selectionStart = input.selectionEnd = formattedValue.length;
      };
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

    // Контактная информация обязательна
    if (!newSupplierForm.contact_person || newSupplierForm.contact_person.trim().length < 2) errors.contact_person = 'Обязательное поле';
    if (!newSupplierForm.phone_number || newSupplierForm.phone_number.replace(/\D/g, '').length < 11) errors.phone_number = 'Некорректный номер телефона';
    if (!newSupplierForm.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newSupplierForm.email)) errors.email = 'Некорректный email';
    if (!newSupplierForm.category || newSupplierForm.category.trim().length < 2) errors.category = 'Укажите категорию (пример: металлопрокат)';

    // Теперь поля ОГРН, КПП, ОКПО, ОКАТО тоже обязательны
    if (!newSupplierForm.ogrn) {
      errors.ogrn = 'Обязательное поле';
    } else if (!/^\d{13}(\d{2})?$/.test(newSupplierForm.ogrn)) {
      errors.ogrn = 'ОГРН должен содержать 13 или 15 цифр';
    }
    if (!newSupplierForm.kpp) {
      errors.kpp = 'Обязательное поле';
    } else if (!/^\d{9}$/.test(newSupplierForm.kpp)) {
      errors.kpp = 'КПП должен состоять из 9 цифр';
    }
    if (!newSupplierForm.okpo) {
      errors.okpo = 'Обязательное поле';
    } else if (!/^\d{8}(\d{2})?$/.test(newSupplierForm.okpo)) {
      errors.okpo = 'ОКПО должен содержать 8 или 10 цифр';
    }
    if (!newSupplierForm.okato) {
      errors.okato = 'Обязательное поле';
    } else if (!/^\d{1,20}$/.test(newSupplierForm.okato)) {
      errors.okato = 'Некорректный формат ОКАТО/ОКТМО';
    }

    if (newSupplierForm.ogrn && !/^\d{13}(\d{2})?$/.test(newSupplierForm.ogrn)) errors.ogrn = '13 или 15 цифр';
    if (newSupplierForm.kpp && !/^\d{9}$/.test(newSupplierForm.kpp)) errors.kpp = '9 цифр';
    if (newSupplierForm.okpo && !/^\d{8}(\d{2})?$/.test(newSupplierForm.okpo)) errors.okpo = '8 или 10 цифр';
    if (newSupplierForm.okato && !/^\d{1,20}$/.test(newSupplierForm.okato)) errors.okato = 'Некорректный формат';

    setSupplierFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [newSupplierForm]);

  const handleCreateSupplier = async () => {
    await handleSaveSupplier();
  };

  // Форматируем номер телефона (digits) в отображаемую маску +7 (xxx) xxx-xx-xx
  const formatPhoneForDisplay = (digits?: string | null) => {
    if (!digits) return '';
    const d = digits.replace(/\D/g, '');
    if (!d) return '';
    // Если в базе хранится в формате 8... или 7..., обеспечим 11 цифр
    let dd = d;
    if (dd.length === 10) dd = '7' + dd; // может быть без первой цифры
    if (dd.length < 11) return dd;
    const matrix = '+7 (___) ___-__-__';
    let i = 0;
    let formatted = matrix.replace(/./g, (char) => {
      if (/[_\d]/.test(char) && i < dd.length - 1) {
        return dd[++i];
      } else if (i >= dd.length - 1) {
        return '';
      }
      return char;
    });
    return formatted;
  };

  // Сохранение (создание или обновление)
  const handleSaveSupplier = async () => {
    if (!validateSupplierForm()) return;

    setIsSubmitting(true);
    try {
      const payload = { ...newSupplierForm } as any;
      if (payload.phone_number) payload.phone_number = payload.phone_number.replace(/\D/g, '');

      const isEdit = !!editingSupplierId;
      const url = isEdit ? `${API_BASE_URL}/api/v1/suppliers/my/${editingSupplierId}` : `${API_BASE_URL}/api/v1/suppliers/my`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        let message = isEdit ? 'Не удалось сохранить поставщика' : 'Не удалось создать поставщика';
        const fieldErrs: SupplierFormErrors = {};
        if (errBody) {
          if (typeof errBody.detail === 'string') {
            message = errBody.detail;
          } else if (Array.isArray(errBody.detail)) {
            message = errBody.detail.map((d: any) => `${(d.loc || []).join('.')} — ${d.msg}`).join('; ');
            for (const d of errBody.detail) {
              const loc = d.loc && d.loc.length ? String(d.loc[d.loc.length - 1]) : null;
              if (loc && typeof d.msg === 'string') fieldErrs[loc as keyof SupplierFormErrors] = d.msg;
            }
          } else if (typeof errBody.detail === 'object' && errBody.detail !== null) {
            try {
              message = Object.values(errBody.detail).flat().join('; ');
              for (const k of Object.keys(errBody.detail)) {
                const v = errBody.detail[k];
                if (typeof v === 'string') fieldErrs[k as keyof SupplierFormErrors] = v;
                else if (Array.isArray(v) && v.length) fieldErrs[k as keyof SupplierFormErrors] = String(v[0]);
              }
            } catch {
              message = JSON.stringify(errBody.detail);
            }
          }
        }
        if (Object.keys(fieldErrs).length) setSupplierFormErrors(prev => ({ ...prev, ...fieldErrs }));
        throw new Error(message);
      }

      const saved: Supplier = await res.json();
      if (isEdit) {
        setSuppliers(prev => prev.map(s => (s.id === saved.id ? saved : s)));
        addNotification({ type: 'success', title: 'Поставщик обновлён' });
      } else {
        setSuppliers(prev => [...prev, saved]);
        addNotification({ type: 'success', title: 'Поставщик добавлен' });
      }

      setShowSupplierCreateModal(false);
      setNewSupplierForm({});
      setSupplierFormErrors({});
      setEditingSupplierId(null);
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

    async function fetchCounterparties() {
      try {
        setCpsLoading(true);
        setCpsError(null);
        const response = await fetch(`${API_BASE_URL}/api/v1/counterparties`, { credentials: 'include' });
        if (!response.ok) throw new Error('Не удалось загрузить контрагентов');
        setCounterparties(await response.json());
      } catch (e: any) {
        setCpsError(e.message || 'Ошибка загрузки контрагентов');
      } finally {
        setCpsLoading(false);
      }
    }

    // Загружаем данные для неактивных вкладок в фоне, чтобы не было задержки при переключении
    fetchSuppliers();
    fetchCounterparties();

  }, []);

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

  const handleCpFormChange = (field: keyof CounterpartyCreateForm, value: string | ChangeEvent<HTMLInputElement>) => {
    const inputElement = typeof value !== 'string' ? value.target : null;
    const val = typeof value === 'string' ? value : inputElement?.value ?? '';
    
    if (cpFormErrors[field]) {
      setCpFormErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  
    if (field === 'phone') {
      const input = inputElement;
      if (!input) {
        setCpForm(p => ({ ...p, phone: val }));
        return;
      }
    
      let digits = input.value.replace(/\D/g, '');
      const matrix = "+7 (___) ___-__-__";
    
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
    
      const setCursorToEnd = () => {
        input.selectionStart = input.selectionEnd = formattedValue.length;
      };
      requestAnimationFrame(setCursorToEnd);
    
      setCpForm(p => ({ ...p, phone: formattedValue }));
    } else {
      setCpForm(p => ({ ...p, [field]: val }));
    }
  };


  const validateCpForm = useCallback(() => {
    const errors: CounterpartyFormErrors = {};
    if (!cpForm.short_name || cpForm.short_name.length < 2) errors.short_name = 'Обязательное поле';
    if (!cpForm.legal_address || cpForm.legal_address.length < 3) errors.legal_address = 'Обязательное поле';
    if (!cpForm.inn) {
      errors.inn = 'Обязательное поле';
    } else if (!/^\d{10}(\d{2})?$/.test(cpForm.inn)) {
      errors.inn = 'ИНН должен состоять из 10 или 12 цифр';
    }

    // Обязательные поля
    if (!cpForm.ogrn) {
      errors.ogrn = 'Обязательное поле';
    } else if (!/^\d{13}(\d{2})?$/.test(cpForm.ogrn)) {
      errors.ogrn = '13 или 15 цифр';
    }
    if (!cpForm.kpp) {
      errors.kpp = 'Обязательное поле';
    } else if (!/^\d{9}$/.test(cpForm.kpp)) {
      errors.kpp = '9 цифр';
    }
    if (!cpForm.okpo) {
      errors.okpo = 'Обязательное поле';
    } else if (!/^\d{8}(\d{2})?$/.test(cpForm.okpo)) {
      errors.okpo = '8 или 10 цифр';
    }
    if (!cpForm.okato) {
      errors.okato = 'Обязательное поле';
    } else if (!/^\d{1,20}$/.test(cpForm.okato)) {
      errors.okato = 'Некорректный формат';
    }
    if (!cpForm.contact_person) errors.contact_person = 'Обязательное поле';
    if (!cpForm.phone) errors.phone = 'Обязательное поле';
    if (!cpForm.email) {
      errors.email = 'Обязательное поле';
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cpForm.email)) {
      errors.email = 'Некорректный email';
    }

    // Валидация банковских реквизитов (опционально)
    if (cpForm.bank_account && !/^\d{20}$/.test(cpForm.bank_account)) errors.bank_account = 'Р/с должен состоять из 20 цифр';
    if (cpForm.bank_bik && !/^\d{9}$/.test(cpForm.bank_bik)) errors.bank_bik = 'БИК должен состоять из 9 цифр';
    if (cpForm.bank_corr && !/^\d{20}$/.test(cpForm.bank_corr)) errors.bank_corr = 'Корр. счет должен состоять из 20 цифр';

    setCpFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [cpForm]);

  const handleSaveCounterparty = async () => {
    if (!validateCpForm()) return;

    setIsCpSubmitting(true);
    try {
      const payload = { ...cpForm };
      const isEdit = !!editingCpId;
      const url = isEdit ? `${API_BASE_URL}/api/v1/counterparties/${editingCpId}` : `${API_BASE_URL}/api/v1/counterparties`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ detail: isEdit ? 'Не удалось обновить контрагента' : 'Не удалось создать контрагента' }));
        throw new Error(errBody.detail);
      }

      const saved: Counterparty = await res.json();
      if (isEdit) {
        setCounterparties(prev => prev.map(c => (c.id === saved.id ? saved : c)));
        addNotification({ type: 'success', title: 'Контрагент обновлён' });
      } else {
        setCounterparties(prev => [...prev, saved]);
        addNotification({ type: 'success', title: 'Контрагент добавлен' });
      }

      resetCpModal();
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Ошибка', message: e.message });
    } finally {
      setIsCpSubmitting(false);
    }
  };

  const fetchCpPartySuggest = useCallback(async (q: string) => {
    cpDadataAbort.current?.abort();
    cpDadataAbort.current = new AbortController();
    setCpDadataLoading(true);
    try {
      const url = `${API_BASE_URL}/api/v1/suggest/party?q=${encodeURIComponent(q)}&count=5`;
      const r = await fetch(url, { credentials: 'include', signal: cpDadataAbort.current.signal });
      if (!r.ok) return [];
      const data = await r.json();
      return (data?.suggestions ?? []) as DaDataParty[];
    } catch {
      return [];
    } finally {
      setCpDadataLoading(false);
    }
  }, []);

  const fetchCpAddrSuggest = useCallback(async (q: string) => {
    cpAddrAbort.current?.abort();
    cpAddrAbort.current = new AbortController();
    setCpAddrLoading(true);
    try {
      const url = `${API_BASE_URL}/api/v11/suggest/address?q=${encodeURIComponent(q)}&count=5`;
      const r = await fetch(url, { credentials: 'include', signal: cpAddrAbort.current.signal });
      const data = await r.json();
      return (data?.suggestions ?? []).map((s: any) => ({ value: s.value, unrestricted_value: s.unrestricted_value })) as DaDataAddr[];
    } catch {
      return [];
    } finally {
      setCpAddrLoading(false);
    }
  }, []);

  useEffect(() => {
    const qParty = cpDadataQuery.trim();
    if (cpDadataFocus && qParty.length >= 2) {
      const t = setTimeout(() => fetchCpPartySuggest(qParty).then(setCpDadataSugg), 300);
      return () => clearTimeout(t);
    } else if (!cpDadataFocus) {
      setCpDadataSugg([]);
    }
  }, [cpDadataQuery, cpDadataFocus, fetchCpPartySuggest]);

  useEffect(() => {
    const qAddr = cpAddrQuery.trim();
    if (cpAddrFocus && qAddr.length >= 3) {
      const t = setTimeout(() => fetchCpAddrSuggest(qAddr).then(setCpAddrSugg), 300);
      return () => clearTimeout(t);
    } else if (!cpAddrFocus) {
      setCpAddrSugg([]);
    }
  }, [cpAddrQuery, cpAddrFocus, fetchCpAddrSuggest]);

  const handlePickCpDadataParty = (party: DaDataParty) => {
    setCpForm({
      ...cpForm,
      short_name: party.short_name || '',
      legal_address: party.legal_address || '',
      inn: party.inn || '',
      kpp: party.kpp || '',
      ogrn: party.ogrn || '',
      okpo: party.okpo || '',
      okato: party.okato || '',
    });
    setCpDadataSugg([]);
    setCpDadataQuery('');
    setCpFormErrors({});
  };

  const handlePickCpAddr = (val: string) => {
    handleCpFormChange('legal_address', val);
    setCpAddrQuery(val);
    setCpAddrSugg([]);
  };

  const resetCpModal = () => {
    setShowCpModal(false);
    setEditingCpId(null);
    setCpForm({});
    setCpFormErrors({});
    setCpDadataQuery('');
    setCpDadataSugg([]);
    setCpAddrQuery('');
    setCpAddrSugg([]);
  };

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
              <button
                onClick={() => setActiveTab('counterparties')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'counterparties'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Контрагенты
              </button>
            </nav>
          </div>

          {/* Контент вкладок */}
          <div>
            {activeTab === 'requests' && <RequestsList />}

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
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
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
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <button onClick={() => {
                                  // Открыть модал в режиме редактирования
                                  setEditingSupplierId(s.id);
                                  setShowSupplierCreateModal(true);
                                  // Привести номер телефона к формату для отображения
                                  setNewSupplierForm({
                                    short_name: s.short_name,
                                    legal_address: s.legal_address,
                                    inn: s.inn,
                                    kpp: s.kpp,
                                    ogrn: s.ogrn,
                                    okpo: s.okpo,
                                    okato: s.okato,
                                    contact_person: s.contact_person,
                                    phone_number: formatPhoneForDisplay(s.phone_number),
                                    email: s.email,
                                    category: s.category,
                                  });
                                }} className="text-amber-600 hover:underline text-sm">Изменить</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'counterparties' && (
              <div>
                <div className="flex justify-end mb-4">
                  <button onClick={() => { setShowCpModal(true); setEditingCpId(null); setCpForm({}); }} className="px-4 py-2 bg-emerald-600 text-white rounded-md whitespace-nowrap">
                    + Добавить контрагента
                  </button>
                </div>
                {cpsLoading && <SkeletonLoader className="h-40 w-full" />}
                {!cpsLoading && cpsError && <div className="bg-white rounded-xl shadow p-6 text-red-600">{cpsError}</div>}
                {!cpsLoading && !cpsError && counterparties.length === 0 && (
                  <div className="bg-white rounded-xl shadow p-6 text-center">
                    <p className="text-gray-700">У вас пока нет контрагентов.</p>
                  </div>
                )}
                {!cpsLoading && !cpsError && counterparties.length > 0 && (
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
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200 text-sm ">
                        {counterparties.map(cp => (
                          <tr key={cp.id}>
                            <td className="px-6 py-4 whitespace-nowrap font-medium">{cp.short_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{cp.inn}{cp.kpp ? ` / ${cp.kpp}` : ''}</td>
                            <td className="px-6 py-4">{cp.legal_address}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{cp.contact_person || '—'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{cp.phone || '—'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{cp.email || '—'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <button onClick={() => {
                                  setEditingCpId(cp.id);
                                  setShowCpModal(true);
                                  setCpForm(cp);
                                }} className="text-amber-600 hover:underline text-sm">Изменить</button>
                              </div>
                            </td>
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
                <h3 className="text-xl font-semibold">{editingSupplierId ? 'Редактирование поставщика' : 'Новый поставщик'}</h3>

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
                    <label className="text-xs text-gray-600">ОГРН*</label>
                    <input className={supplierFormErrors.ogrn ? clsInputError : clsInput} placeholder="13 или 15 цифр" value={newSupplierForm.ogrn || ''} onChange={e => handleSupplierFormChange('ogrn', e.target.value)} />
                    {supplierFormErrors.ogrn && <p className="text-xs text-red-600 mt-1">{supplierFormErrors.ogrn}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">КПП*</label>
                    <input className={supplierFormErrors.kpp ? clsInputError : clsInput} placeholder="9 цифр" value={newSupplierForm.kpp || ''} onChange={e => handleSupplierFormChange('kpp', e.target.value)} />
                    {supplierFormErrors.kpp && <p className="text-xs text-red-600 mt-1">{supplierFormErrors.kpp}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">ОКПО*</label>
                    <input className={supplierFormErrors.okpo ? clsInputError : clsInput} placeholder="8 или 10 цифр" value={newSupplierForm.okpo || ''} onChange={e => handleSupplierFormChange('okpo', e.target.value)} />
                    {supplierFormErrors.okpo && <p className="text-xs text-red-600 mt-1">{supplierFormErrors.okpo}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">ОКАТО/ОКТМО*</label>
                    <input className={supplierFormErrors.okato ? clsInputError : clsInput} value={newSupplierForm.okato || ''} onChange={e => handleSupplierFormChange('okato', e.target.value)} />
                    {supplierFormErrors.okato && <p className="text-xs text-red-600 mt-1">{supplierFormErrors.okato}</p>}
                  </div>
                  <div className="md:col-span-3 border-t pt-4">
                     <h4 className="text-md font-semibold text-gray-800 mb-2">Контактная информация</h4>
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-gray-600">Категория* <span className="text-xs text-gray-400">(в именительном падеже, напр.: металлопрокат, дерево, кроссовки)</span></label>
                    <input className={supplierFormErrors.category ? clsInputError : clsInput} placeholder="Категория" value={newSupplierForm.category || ''} onChange={e => handleSupplierFormChange('category', e.target.value)} />
                    {supplierFormErrors.category && <p className="text-xs text-red-600 mt-1">{supplierFormErrors.category}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">ФИО контактного лица</label>
                    <input className={supplierFormErrors.contact_person ? clsInputError : clsInput} placeholder="Иванов Иван Иванович" value={newSupplierForm.contact_person || ''} onChange={e => handleSupplierFormChange('contact_person', e.target.value)} />
                    {supplierFormErrors.contact_person && <p className="text-xs text-red-600 mt-1">{supplierFormErrors.contact_person}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Номер телефона</label>
                    <input type="tel" className={supplierFormErrors.phone_number ? clsInputError : clsInput} placeholder="+7 (999) 123-45-67" value={newSupplierForm.phone_number || ''} onChange={e => handleSupplierFormChange('phone_number', e)} maxLength={18} />
                    {supplierFormErrors.phone_number && <p className="text-xs text-red-600 mt-1">{supplierFormErrors.phone_number}</p>}
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-gray-600">Почта</label>
                    <input type="email" className={supplierFormErrors.email ? clsInputError : clsInput} placeholder="supplier@example.com" value={newSupplierForm.email || ''} onChange={e => handleSupplierFormChange('email', e.target.value)} />
                    {supplierFormErrors.email && <p className="text-xs text-red-600 mt-1">{supplierFormErrors.email}</p>}
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t">
                  <button onClick={handleSaveSupplier} disabled={isSubmitting} className="px-4 py-2 bg-emerald-600 text-white rounded-md disabled:opacity-50">
                    {isSubmitting ? (editingSupplierId ? 'Сохранение...' : 'Сохранение...') : (editingSupplierId ? 'Сохранить изменения' : 'Сохранить')}
                  </button>
                  <button onClick={() => { resetSupplierModal(); setEditingSupplierId(null); }} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50">
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Модальное окно контрагента */}
          {showCpModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl p-6 space-y-4 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-semibold">{editingCpId ? 'Редактирование контрагента' : 'Новый контрагент'}</h3>

                {/* Поиск по DaData */}
                <div className="relative">
                  <label className="text-xs text-gray-600">Поиск организации для автоматического заполнения</label>
                  <input
                    className={clsInput}
                    placeholder="Введите ИНН, ОГРН или название организации для автозаполнения"
                    value={cpDadataQuery}
                    onChange={e => setCpDadataQuery(e.target.value)}
                    onFocus={() => setCpDadataFocus(true)}
                    onBlur={() => setTimeout(() => setCpDadataFocus(false), 200)}
                  />
                  {cpDadataLoading && <div className="text-xs text-gray-500 mt-1">Поиск...</div>}
                  {cpDadataFocus && cpDadataSugg.length > 0 && (
                    <div className="absolute z-40 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
                      {cpDadataSugg.map((p, i) => (
                        <button type="button" key={i} onMouseDown={() => handlePickCpDadataParty(p)} className="block w-full text-left px-3 py-2 hover:bg-amber-50 text-sm">
                          <div className="font-semibold">{p.short_name || p.value}</div>
                          <div className="text-xs text-gray-600">ИНН: {p.inn}, {p.legal_address}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Основное */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                  <h4 className="md:col-span-3 text-md font-semibold text-gray-800">Основные реквизиты</h4>
                  <div>
                    <label className="text-xs text-gray-600">Краткое наименование*</label>
                    <input className={cpFormErrors.short_name ? clsInputError : clsInput} placeholder="ООО Ромашка" value={cpForm.short_name || ''} onChange={e => handleCpFormChange('short_name', e.target.value)} />
                    {cpFormErrors.short_name && <p className="text-xs text-red-600 mt-1">{cpFormErrors.short_name}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <div className="relative">
                      <label className="text-xs text-gray-600">Юридический адрес*</label>
                      <input
                        className={cpFormErrors.legal_address ? clsInputError : clsInput}
                        placeholder="Начните вводить юр. адрес..."
                        value={cpForm.legal_address || ''}
                        onFocus={() => { setCpAddrFocus(true); setCpAddrQuery(cpForm.legal_address || ''); }}
                        onBlur={() => setTimeout(() => setCpAddrFocus(false), 150)}
                        onChange={e => {
                          handleCpFormChange('legal_address', e.target.value);
                          setCpAddrQuery(e.target.value);
                        }}
                      />
                      {cpFormErrors.legal_address && <p className="text-xs text-red-600 mt-1">{cpFormErrors.legal_address}</p>}
                      {cpAddrFocus && cpAddrSugg.length > 0 && (
                        <div className="absolute z-30 mt-1 w-full max-h-48 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
                          {cpAddrSugg.map((s, i) => (
                            <button type="button" key={i} onMouseDown={() => handlePickCpAddr(s.unrestricted_value || s.value)} className="block w-full text-left px-3 py-2 hover:bg-amber-50 text-sm">
                              {s.unrestricted_value || s.value}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">ИНН*</label>
                    <input className={cpFormErrors.inn ? clsInputError : clsInput} placeholder="10 или 12 цифр" value={cpForm.inn || ''} onChange={e => handleCpFormChange('inn', e.target.value)} />
                    {cpFormErrors.inn && <p className="text-xs text-red-600 mt-1">{cpFormErrors.inn}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">ОГРН*</label>
                    <input className={cpFormErrors.ogrn ? clsInputError : clsInput} placeholder="13 или 15 цифр" value={cpForm.ogrn || ''} onChange={e => handleCpFormChange('ogrn', e.target.value)} />
                    {cpFormErrors.ogrn && <p className="text-xs text-red-600 mt-1">{cpFormErrors.ogrn}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">КПП*</label>
                    <input className={cpFormErrors.kpp ? clsInputError : clsInput} placeholder="9 цифр" value={cpForm.kpp || ''} onChange={e => handleCpFormChange('kpp', e.target.value)} />
                    {cpFormErrors.kpp && <p className="text-xs text-red-600 mt-1">{cpFormErrors.kpp}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">ОКПО*</label>
                    <input className={cpFormErrors.okpo ? clsInputError : clsInput} placeholder="8 или 10 цифр" value={cpForm.okpo || ''} onChange={e => handleCpFormChange('okpo', e.target.value)} />
                    {cpFormErrors.okpo && <p className="text-xs text-red-600 mt-1">{cpFormErrors.okpo}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">ОКАТО/ОКТМО*</label>
                    <input className={cpFormErrors.okato ? clsInputError : clsInput} value={cpForm.okato || ''} onChange={e => handleCpFormChange('okato', e.target.value)} />
                    {cpFormErrors.okato && <p className="text-xs text-red-600 mt-1">{cpFormErrors.okato}</p>}
                  </div>
                </div>

                {/* Банк */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                  <h4 className="md:col-span-3 text-md font-semibold text-gray-800">Банковские реквизиты</h4>
                  <div>
                    <label className="text-xs text-gray-600">Расчётный счёт</label>
                    <input className={cpFormErrors.bank_account ? clsInputError : clsInput} placeholder="20 цифр" value={cpForm.bank_account || ''} onChange={e => handleCpFormChange('bank_account', e.target.value)} />
                    {cpFormErrors.bank_account && <p className="text-xs text-red-600 mt-1">{cpFormErrors.bank_account}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">БИК банка</label>
                    <input className={cpFormErrors.bank_bik ? clsInputError : clsInput} placeholder="9 цифр" value={cpForm.bank_bik || ''} onChange={e => handleCpFormChange('bank_bik', e.target.value)} />
                    {cpFormErrors.bank_bik && <p className="text-xs text-red-600 mt-1">{cpFormErrors.bank_bik}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Наименование банка</label>
                    <input className={cpFormErrors.bank_name ? clsInputError : clsInput} placeholder="ПАО Сбербанк" value={cpForm.bank_name || ''} onChange={e => handleCpFormChange('bank_name', e.target.value)} />
                    {cpFormErrors.bank_name && <p className="text-xs text-red-600 mt-1">{cpFormErrors.bank_name}</p>}
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-gray-600">Корр. счёт</label>
                    <input className={cpFormErrors.bank_corr ? clsInputError : clsInput} placeholder="20 цифр" value={cpForm.bank_corr || ''} onChange={e => handleCpFormChange('bank_corr', e.target.value)} />
                    {cpFormErrors.bank_corr && <p className="text-xs text-red-600 mt-1">{cpFormErrors.bank_corr}</p>}
                  </div>
                </div>

                {/* Контактная информация */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                  <h4 className="md:col-span-3 text-md font-semibold text-gray-800">Контактная информация</h4>
                  <div>
                    <label className="text-xs text-gray-600">ФИО контактного лица*</label>
                    <input className={cpFormErrors.contact_person ? clsInputError : clsInput} placeholder="Иванов И.И." value={cpForm.contact_person || ''} onChange={e => handleCpFormChange('contact_person', e.target.value)} />
                    {cpFormErrors.contact_person && <p className="text-xs text-red-600 mt-1">{cpFormErrors.contact_person}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Телефон*</label>
                    <input className={cpFormErrors.phone ? clsInputError : clsInput} placeholder="+7 (999) 999-99-99" value={cpForm.phone || ''} onChange={e => handleCpFormChange('phone', e)} />
                    {cpFormErrors.phone && <p className="text-xs text-red-600 mt-1">{cpFormErrors.phone}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">E-mail*</label>
                    <input className={cpFormErrors.email ? clsInputError : clsInput} placeholder="contact@company.ru" value={cpForm.email || ''} onChange={e => handleCpFormChange('email', e.target.value)} />
                    {cpFormErrors.email && <p className="text-xs text-red-600 mt-1">{cpFormErrors.email}</p>}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <button onClick={handleSaveCounterparty} disabled={isCpSubmitting} className="px-4 py-2 bg-emerald-600 text-white rounded-md disabled:opacity-50">
                    {isCpSubmitting ? 'Сохранение...' : (editingCpId ? 'Сохранить изменения' : 'Создать контрагента')}
                  </button>
                  <button onClick={resetCpModal} disabled={isCpSubmitting} className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50">
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
