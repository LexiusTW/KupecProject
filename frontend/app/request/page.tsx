'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, useCallback, type KeyboardEvent } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SkeletonLoader from '../components/SkeletonLoader';
import Notification, { type NotificationProps } from '../components/Notification';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// ---------- Helpers ----------
const makeId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2, 9));

const units = [
  { value: 'шт', label: 'Штук (шт)' },
  { value: 'г', label: 'Грамм (г)' },
  { value: 'кг', label: 'Килограмм (кг)' },
  { value: 'т', label: 'Тонна (т)' },
  { value: 'м', label: 'Метр (м)' },
  { value: 'пог. м', label: 'Погонный метр (пог. м)' },
  { value: 'м²', label: 'Квадратный метр (м²)' },
  { value: 'л', label: 'Литр (л)' },
  { value: 'м³', label: 'Кубический метр (м³)' },
];

// ---------------- Types ----------------

type PositionRow = {
  id: string;
  name: string;
  specifications: string;
  unit: string;
  quantity: string | number;
};

type CategoryBlock = {
  id: string;
  title: string;
  items: PositionRow[];
  editingTitle: boolean;
};

type SavedItem = {
  id: string;
  kind: 'generic';
  category: string;
  name: string;
  dims?: string | null;
  unit?: string | null;
  quantity: number | null;
  allow_analogs: boolean;
  comment: string;
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
  director?: string;
  phone?: string;
  email?: string;
};

type CounterpartyCreateForm = Partial<Omit<Counterparty, 'id'>>;
type CounterpartyFormErrors = { [K in keyof CounterpartyCreateForm]?: string };

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
type DaDataAddr = { value: string; unrestricted_value: string; };
type HeaderErrors = { title?: string; deliveryAt?: string; address?: string; counterparty?: string; };
type RequestRow = { id: string; display_id: string; created_at: string; status: string; delivery_address: string; counterparty: { id: number; short_name: string; inn: string; } | null; items: SavedItem[]; };

const clsInput =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:text-gray-500';
const clsInputError =
  'w-full px-3 py-2 border border-red-500 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500';
const clsBtn = 'px-4 py-2 rounded-md';
const clsBtnPrimary = `bg-amber-600 text-white ${clsBtn} disabled:opacity-50`;

type Tab = 'create' | 'list';

const RequestsList = ({ onSwitchToCreate }: { onSwitchToCreate: () => void }) => {
    const [requestsLoading, setRequestsLoading] = useState(true);
    const [requests, setRequests] = useState<RequestRow[]>([]);
    const [requestsError, setRequestsError] = useState<string | null>(null);
    const [sort, setSort] = useState<{ key: keyof RequestRow, order: 'asc' | 'desc' }>({ key: 'created_at', order: 'desc' });
    const [filters, setFilters] = useState({ date: '', status: '', counterparty: '' });
  
    useEffect(() => {
      async function fetchRequests() {
        try {
          setRequestsLoading(true);
          const response = await fetch(`${API_BASE_URL}/api/v1/requests/me`, { credentials: 'include' });
          if (!response.ok) throw new Error('Не удалось загрузить заявки');
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
      setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
  
    const handleSort = (key: keyof RequestRow) => {
      setSort(prev => ({ key, order: prev.key === key && prev.order === 'asc' ? 'desc' : 'asc' }));
    };
  
    const getSortIndicator = (key: string) => {
      if (sort.key !== key) return null;
      return sort.order === 'asc' ? ' ▲' : ' ▼';
    };
  
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Заявка создана': return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Заявка создана</span>;
            case 'Поиск поставщиков': return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Поиск поставщиков</span>;
            case 'КП отправлено': return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">КП отправлено</span>;
            case 'Оплачено': return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Оплачено</span>;
            case 'В доставке': return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-cyan-100 text-cyan-800">В доставке</span>;
            case 'Сделка закрыта': return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Сделка закрыта</span>;
            default: return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
        }
    };

    const filteredAndSortedRequests = useMemo(() => {
        return requests
          .filter(req => {
            const dateMatch = filters.date ? new Date(req.created_at).toISOString().split('T')[0] === filters.date : true;
            const statusMatch = filters.status ? req.status === filters.status : true;
            const cpMatch = filters.counterparty ? 
              (req.counterparty?.short_name.toLowerCase().includes(filters.counterparty.toLowerCase()) ||
              req.counterparty?.inn?.includes(filters.counterparty)) : true;
            return statusMatch && cpMatch && dateMatch;
          })
          .sort((a, b) => {
            let aValue: any = a[sort.key];
            let bValue: any = b[sort.key];
            if (sort.key === 'counterparty') {
                aValue = a.counterparty?.short_name || '';
                bValue = b.counterparty?.short_name || '';
            }
            if (aValue < bValue) return sort.order === 'asc' ? -1 : 1;
            if (aValue > bValue) return sort.order === 'asc' ? 1 : -1;
            return 0;
          });
      }, [requests, filters, sort]);

    if (requestsLoading) return <div className="bg-white rounded-xl shadow p-6"><SkeletonLoader className="h-40 w-full" /></div>;
    if (requestsError) return <div className="bg-white rounded-xl shadow p-6 text-red-600">{requestsError}</div>;
    if (requests.length === 0) return (
        <div className="bg-white rounded-xl shadow p-6 text-center">
            <p className="text-gray-700">У вас пока нет заявок.</p>
            <button onClick={onSwitchToCreate} className="inline-block mt-4 border border-amber-600 text-amber-700 px-4 py-2 rounded-md hover:bg-amber-50">Оставить первую заявку</button>
        </div>
    );

    return (
        <div>
            <div className="bg-white p-4 rounded-lg shadow mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input type="date" name="date" value={filters.date} onChange={handleFilterChange} className={clsInput} />
                    <select name="status" value={filters.status} onChange={handleFilterChange} className={clsInput}>
                        <option value="">Все статусы</option>
                        <option value="Заявка создана">Заявка создана</option>
                        <option value="Поиск поставщиков">Поиск поставщиков</option>
                        <option value="КП отправлено">КП отправлено</option>
                        <option value="Оплачено">Оплачено</option>
                        <option value="В доставке">В доставке</option>
                        <option value="Сделка закрыта">Сделка закрыта</option>
                    </select>
                    <input type="text" name="counterparty" value={filters.counterparty} onChange={handleFilterChange} placeholder="Поиск по контрагенту..." className={clsInput} />
                </div>
            </div>
            <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th onClick={() => handleSort('display_id')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">№{getSortIndicator('display_id')}</th>
                            <th onClick={() => handleSort('created_at')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">Дата{getSortIndicator('created_at')}</th>
                            <th onClick={() => handleSort('status')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">Статус{getSortIndicator('status')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Адрес</th>
                            <th onClick={() => handleSort('counterparty')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">Контрагент{getSortIndicator('counterparty')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Позиций</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAndSortedRequests.map((request) => (
                            <tr key={request.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/request/${request.id}`}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{request.display_id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(request.created_at).toLocaleDateString('ru-RU')}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(request.status)}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={request.delivery_address}>{request.delivery_address}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.counterparty?.short_name || '—'}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 text-center">{request.items.length}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default function RequestPage() {
  const [activeTab, setActiveTab] = useState<Tab>('create');
  
  // ---------------- Header fields ----------------
  const [title, setTitle] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('requestForm_title') || '' : ''));
  const [deliveryAt, setDeliveryAt] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('requestForm_deliveryAt') || '' : ''));
  const [address, setAddress] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('requestForm_address') || '' : ''));
  const [addressSugg, setAddressSugg] = useState<DaDataAddr[]>([]);
  const [addressFocus, setAddressFocus] = useState(false);
  const addressAbort = useRef<AbortController | null>(null);
  const [headerErrors, setHeaderErrors] = useState<HeaderErrors>({});

  const [isLoading, setIsLoading] = useState(true);
  
  // ---------------- Counterparty fields ----------------
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [selectedCp, setSelectedCp] = useState<Counterparty | null>(null);
  const [showCpModal, setShowCpModal] = useState(false);
  const [cpForm, setCpForm] = useState<CounterpartyCreateForm>({});
  const [cpFormErrors, setCpFormErrors] = useState<CounterpartyFormErrors>({});
  const [editingCpId, setEditingCpId] = useState<number | null>(null);
  const [isCpSubmitting, setIsCpSubmitting] = useState(false);

  const [cpDadataQuery, setCpDadataQuery] = useState('');
  const [cpDadataSugg, setCpDadataSugg] = useState<DaDataParty[]>([]);
  const [cpDadataFocus, setCpDadataFocus] = useState(false);
  const [cpDadataLoading, setCpDadataLoading] = useState(false);
  const cpDadataAbort = useRef<AbortController | null>(null);

  const [cpAddrQuery, setCpAddrQuery] = useState('');
  const [cpAddrSugg, setCpAddrSugg] = useState<DaDataAddr[]>([]);
  const [cpAddrFocus, setCpAddrFocus] = useState(false);
  const cpAddrAbort = useRef<AbortController | null>(null);

  // ---------------- Categories ----------------
  const [cats, setCats] = useState<CategoryBlock[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('requestForm_cats');
    try {
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.error("Failed to parse cats from localStorage", e);
        return [];
    }
  });

  // ---------------- UI State ----------------
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notifications, setNotifications] = useState<Omit<NotificationProps, 'onDismiss'>[]>([]);

  const addNotification = (notif: Omit<NotificationProps, 'id' | 'onDismiss'>) => {
    const id = makeId();
    setNotifications(prev => [...prev, { id, ...notif }]);
  };

  const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));

  // ------- Load counterparties and set selected one from localStorage ------- 
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const counterpartiesRes = await fetch(`${API_BASE_URL}/api/v1/counterparties`, { credentials: 'include' });
        if (counterpartiesRes && counterpartiesRes.ok) {
            const cpData: Counterparty[] = await counterpartiesRes.json();
            setCounterparties(cpData);

            const savedCpId = localStorage.getItem('requestForm_selectedCpId');
            if (savedCpId) {
                const cp = cpData.find(c => c.id === Number(savedCpId));
                if (cp) setSelectedCp(cp);
            }
        }
      } catch (error) {
        console.error("Failed to load initial data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // ------- Save form data to localStorage on change ------- 
  useEffect(() => {
    localStorage.setItem('requestForm_title', title);
  }, [title]);

  useEffect(() => {
      localStorage.setItem('requestForm_deliveryAt', deliveryAt);
  }, [deliveryAt]);

  useEffect(() => {
      localStorage.setItem('requestForm_address', address);
  }, [address]);

  useEffect(() => {
      if (selectedCp) {
          localStorage.setItem('requestForm_selectedCpId', String(selectedCp.id));
      } else {
          localStorage.removeItem('requestForm_selectedCpId');
      }
  }, [selectedCp]);

  useEffect(() => {
      if (cats.length > 0) {
          localStorage.setItem('requestForm_cats', JSON.stringify(cats));
      } else {
          localStorage.removeItem('requestForm_cats');
      }
  }, [cats]);


  // ------- DaData Address Suggestions (Header) ------- 
  const fetchHeaderAddrSuggest = useCallback(async (q: string) => {
    addressAbort.current?.abort();
    addressAbort.current = new AbortController();
    try {
        const url = `${API_BASE_URL}/api/v1/suggest/address?q=${encodeURIComponent(q)}&count=5`;
        const r = await fetch(url, { credentials: 'include', signal: addressAbort.current.signal });
        if (!r.ok) return [];
        const data = await r.json();
        return (data?.suggestions ?? []).map((s: any) => ({ value: s.value, unrestricted_value: s.unrestricted_value }));
    } catch { return []; }
  }, []);

  useEffect(() => {
    const q = address.trim();
    if (addressFocus && q.length >= 3) {
        const t = setTimeout(() => fetchHeaderAddrSuggest(q).then(setAddressSugg), 300);
        return () => clearTimeout(t);
    } else if (!addressFocus) {
        setAddressSugg([]);
    }
  }, [address, addressFocus, fetchHeaderAddrSuggest]);

  // ------- Counterparty Modal Logic (from account/page.tsx) ------- 
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
    try {
      const url = `${API_BASE_URL}/api/v1/suggest/address?q=${encodeURIComponent(q)}&count=5`;
      const r = await fetch(url, { credentials: 'include', signal: cpAddrAbort.current.signal });
      const data = await r.json();
      return (data?.suggestions ?? []).map((s: any) => ({ value: s.value, unrestricted_value: s.unrestricted_value })) as DaDataAddr[];
    } catch {
      return [];
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
      const formattedValue = matrix.replace(/./g, (char) => {
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
    if (!cpForm.okato) errors.okato = 'Обязательное поле';
    if (!cpForm.director) errors.director = 'Обязательное поле';
    if (!cpForm.phone) errors.phone = 'Обязательное поле';
    if (!cpForm.email) {
      errors.email = 'Обязательное поле';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cpForm.email)) {
      errors.email = 'Некорректный email';
    }
    if (cpForm.bank_account && !/^\d{20}$/.test(cpForm.bank_account)) errors.bank_account = 'Р/с должен состоять из 20 цифр';
    if (cpForm.bank_bik && !/^\d{9}$/.test(cpForm.bank_bik)) errors.bank_bik = 'БИК должен состоять из 9 цифр';
    if (cpForm.bank_corr && !/^\d{20}$/.test(cpForm.bank_corr)) errors.bank_corr = 'Корр. счет должен состоять из 20 цифр';

    setCpFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [cpForm]);

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
      setSelectedCp(saved); // Automatically select the new/edited counterparty
      resetCpModal();
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Ошибка', message: e.message });
    } finally {
      setIsCpSubmitting(false);
    }
  };

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

  const handleSelectCp = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cpId = e.target.value;
    if (cpId === '__add_new__') {
      setShowCpModal(true);
      setEditingCpId(null);
      setCpForm({});
      // The select value will be "__add_new__" temporarily.
      // When the modal is closed, a re-render will happen, and React will
      // set the value back to selectedCp?.id from the state, correcting it.
      return;
    }
    const cp = counterparties.find(c => c.id.toString() === cpId);
    setSelectedCp(cp || null);
    if (headerErrors.counterparty) setHeaderErrors(p => ({ ...p, counterparty: undefined }));
  };

  // ------- Category helpers ------- 
  const addCategory = () => setCats(cs => [
      ...cs,
      { id: makeId(), title: '', items: [], editingTitle: true }
    ]);
  
  const removeCategory = (cid: string) => {
    setCats(cs => cs.filter(c => c.id !== cid));
  };

  const finalizeCategoryTitle = (cid: string, title: string) => {
    setCats(cs => cs.map(c => c.id === cid ? { ...c, title, editingTitle: false } : c));
  };

  const reopenCategoryTitle = (cid: string) =>
    setCats(cs => cs.map(c => c.id === cid ? { ...c, editingTitle: true } : c));

  const updateCategoryItems = (cid: string, newItems: PositionRow[]) => {
    setCats(cs => cs.map(c => c.id === cid ? { ...c, items: newItems } : c));
  };

  // ------- Whole request save ------- 
  const allSavedItems = useMemo(() => cats.flatMap(c => c.items), [cats]);

  const validateHeader = (): boolean => {
    const errors: HeaderErrors = {};
    if (!title.trim()) errors.title = 'Название заявки обязательно';
    if (!deliveryAt) errors.deliveryAt = 'Дата обязательна';
    if (!address.trim()) errors.address = 'Адрес поставки обязателен';
    if (!selectedCp) errors.counterparty = 'Контрагент обязателен';
    setHeaderErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveRequest = async () => {
    if (isSubmitting) return;
    const isHeaderValid = validateHeader();
    if (!isHeaderValid) {
      addNotification({ type: 'warning', title: 'Неполные данные', message: 'Заполните обязательные поля в шапке заявки.' });
      return;
    }

    // --- Start New Validation Logic ---
    const allItems = cats.flatMap(c => c.items);
    // An item is considered "intended" if any of its fields are filled.
    const intendedItems = allItems.filter(item => 
        item.name.trim() !== '' || 
        item.specifications.trim() !== '' || 
        String(item.quantity).trim() !== ''
    );

    if (intendedItems.length === 0) {
        addNotification({ type: 'warning', title: 'Пустая заявка', message: 'Добавьте хотя бы одну позицию, чтобы продолжить.' });
        return;
    }

    // Check if any of the "intended" items are missing required fields.
    const hasInvalidItems = intendedItems.some(item => 
        item.name.trim() === '' || 
        String(item.quantity).trim() === ''
    );

    if (hasInvalidItems) {
        addNotification({ type: 'error', title: 'Ошибка в позициях', message: 'Для всех добавленных позиций должны быть указаны Наименование и Количество.' });
        return;
    }
    // --- End New Validation Logic ---

    setIsSubmitting(true);
    try {
      const itemsToSave: SavedItem[] = cats.flatMap(cat =>
        cat.items
          .filter(item => item.name.trim() && String(item.quantity).trim())
          .map(item => ({
            id: item.id,
            kind: 'generic',
            category: cat.title.trim() || 'Прочее',
            name: item.name.trim(),
            dims: item.specifications.trim() || null,
            unit: item.unit.trim() || 'шт.',
            quantity: Number(item.quantity) || null,
            allow_analogs: false,
            comment: '',
          }))
      );

      const r = await fetch(`${API_BASE_URL}/api/v1/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: itemsToSave,
          comment: title?.trim() || null,
          delivery_at: deliveryAt || null,
          delivery_address: address || null,
          counterparty_id: selectedCp?.id || null,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || 'Не удалось сохранить заявку');
      }
      addNotification({ type: 'success', title: 'Заявка сохранена' });
      setActiveTab('list');
      // Clear localStorage and state
      localStorage.removeItem('requestForm_title');
      localStorage.removeItem('requestForm_deliveryAt');
      localStorage.removeItem('requestForm_address');
      localStorage.removeItem('requestForm_selectedCpId');
      localStorage.removeItem('requestForm_cats');
      setTitle('');
      setDeliveryAt('');
      setAddress('');
      setSelectedCp(null);
      setCats([]);

    } catch (e: any) {
      addNotification({ type: 'error', title: 'Ошибка сохранения', message: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------- Render ----------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <Header />
      <main className="flex-grow">
        <div className="fixed top-24 right-5 z-50 w-full max-w-sm space-y-3">
          {notifications.map(notif => (
            <Notification key={notif.id} {...notif} onDismiss={removeNotification} />
          ))}
        </div>
        <div className="container mx-auto px-4 py-8">
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button onClick={() => setActiveTab('create')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'create' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Новая заявка</button>
                <button onClick={() => setActiveTab('list')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'list' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Список заявок</button>
            </nav>
          </div>

          {activeTab === 'create' && (
            <div className="space-y-6">
              {/* ---- Шапка заявки ---- */}
              <div className="bg-white rounded-xl shadow p-5">
                {isLoading ? (
                  <SkeletonLoader className="h-40 w-full" />
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Название заявки*</label>
                        <input className={headerErrors.title ? clsInputError : clsInput} value={title} onChange={(e) => { setTitle(e.target.value); if (headerErrors.title) setHeaderErrors(p => ({ ...p, title: undefined })); }} placeholder="Например: Поставка на объект А" />
                        {headerErrors.title && <p className="text-xs text-red-600 mt-1">{headerErrors.title}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Дата поставки*</label>
                        <input type="date" className={headerErrors.deliveryAt ? clsInputError : clsInput} value={deliveryAt} onChange={(e) => { setDeliveryAt(e.target.value); if (headerErrors.deliveryAt) setHeaderErrors(p => ({ ...p, deliveryAt: undefined })); }} />
                        {headerErrors.deliveryAt && <p className="text-xs text-red-600 mt-1">{headerErrors.deliveryAt}</p>}
                      </div>
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Адрес поставки*</label>
                        <input 
                          className={`${headerErrors.address ? clsInputError : clsInput} w-full`} 
                          value={address} 
                          onChange={(e) => setAddress(e.target.value)} 
                          onFocus={() => setAddressFocus(true)}
                          onBlur={() => setTimeout(() => setAddressFocus(false), 200)}
                          placeholder="Начните вводить адрес..." 
                        />
                        {addressFocus && addressSugg.length > 0 && (
                          <div className="absolute z-40 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
                            {addressSugg.map((s, i) => (
                              <button type="button" key={i} onMouseDown={() => { setAddress(s.unrestricted_value || s.value); setAddressSugg([]); }} className="block w-full text-left px-3 py-2 hover:bg-amber-50 text-sm">
                                {s.unrestricted_value || s.value}
                              </button>
                            ))}
                          </div>
                        )}
                        {headerErrors.address && <p className="text-xs text-red-600 mt-1">{headerErrors.address}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Контрагент*</label>
                        <div className="relative flex-grow">
                          <select
                            className={headerErrors.counterparty ? clsInputError : clsInput}
                            value={selectedCp?.id?.toString() || ''}
                            onChange={handleSelectCp}
                          >
                            <option value="" disabled hidden>Выбрать контрагента</option>
                            
                            {counterparties.map(cp => (
                              <option key={cp.id} value={cp.id.toString()}>{cp.short_name} (ИНН: {cp.inn})</option>
                            ))}
                            <option value="__add_new__" >+ Добавить нового</option>
                          </select>
                          {headerErrors.counterparty && <p className="text-xs text-red-600 mt-1">{headerErrors.counterparty}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button type="button" onClick={saveRequest} disabled={isSubmitting} className={clsBtnPrimary}>{isSubmitting ? 'Сохранение...' : 'Сохранить'}</button>
                    </div>
                  </>
                )}
              </div>

              {isLoading ? (
                <div className="bg-white rounded-xl shadow p-5 space-y-4">
                  <SkeletonLoader className="h-8 w-64" />
                  <SkeletonLoader className="h-40 w-full" />
                </div>
              ) : (cats.map(cat => (
                <div key={cat.id} className="bg-white rounded-xl shadow p-5 space-y-4">
                  {cat.editingTitle ? (
                    <div className="flex items-center gap-3">
                      <input
                        className={clsInput}
                        value={cat.title}
                        placeholder="Категория (например, Металлопрокат)"
                        onChange={(e) => setCats(cs => cs.map(c => c.id === cat.id ? { ...c, title: e.target.value } : c))}
                        onKeyDown={(e) => { if (e.key === 'Enter') finalizeCategoryTitle(cat.id, cat.title); }}
                        autoFocus
                      />
                      <button className={clsBtnPrimary} onClick={()=>finalizeCategoryTitle(cat.id, cat.title)}>Применить</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <h2 className="text-xl font-semibold">{cat.title.trim() || 'Новая категория'}</h2>
                      <div className='flex items-center gap-2'>
                        <button className="text-gray-500 hover:text-amber-600" title="Редактировать название" onClick={()=>reopenCategoryTitle(cat.id)}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L17.5 2.5z" /></svg>
                        </button>
                        <button className="text-gray-500 hover:text-red-600" title="Удалить категорию" onClick={()=>removeCategory(cat.id)}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {!cat.editingTitle && (
                      <RequestItemGrid
                          items={cat.items}
                          onItemsChange={(newItems) => updateCategoryItems(cat.id, newItems)}
                      />
                  )}
                </div>
              )))} 

              {!isLoading && (
                <div className="flex justify-start">
                  <button type="button" onClick={addCategory} className="px-5 py-3 border border-dashed border-gray-400 rounded-md text-gray-700 bg-white shadow-sm">
                    + Добавить категорию
                  </button>
                </div>
              )}
            </div>
          )}
          {activeTab === 'list' && <RequestsList onSwitchToCreate={() => setActiveTab('create')} />} 
        </div>
      </main>
      <Footer />

      {/* ---- Модальное окно контрагента (из account/page.tsx) ---- */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ${showCpModal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={resetCpModal}
      >
        <div 
          className={`bg-white rounded-xl shadow-xl p-6 space-y-4 w-full max-w-4xl max-h-[90vh] overflow-y-auto transition-all duration-300 ${showCpModal ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
          onClick={(e) => e.stopPropagation()}
        >
            <h3 className="text-xl font-semibold">{editingCpId ? 'Редактирование контрагента' : 'Новый контрагент'}</h3>

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
                    onChange={e => { handleCpFormChange('legal_address', e.target.value); setCpAddrQuery(e.target.value); }}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
              <h4 className="md:col-span-3 text-md font-semibold text-gray-800">Контактная информация</h4>
              <div>
                <label className="text-xs text-gray-600">ФИО контактного лица*</label>
                <input className={cpFormErrors.director ? clsInputError : clsInput} placeholder="Иванов И.И." value={cpForm.director || ''} onChange={e => handleCpFormChange('director', e.target.value)} />
                {cpFormErrors.director && <p className="text-xs text-red-600 mt-1">{cpFormErrors.director}</p>}
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
    </div>
  );
}

// ------------------- TABLE COMPONENTS -------------------

interface RequestItemGridProps {
    items: PositionRow[];
    onItemsChange: (items: PositionRow[]) => void;
}

const RequestItemGrid: React.FC<RequestItemGridProps> = ({ items, onItemsChange }) => {
    const tableRef = useRef<HTMLTableElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const mousePosRef = useRef({ x: 0, y: 0 });

    const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
    const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
    const [selection, setSelection] = useState<{ start: { row: number; col: number }; end: { row: number; col: number } } | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [isFilling, setIsFilling] = useState(false);
    const [fillSourceSelection, setFillSourceSelection] = useState<typeof selection | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: number; col: number } | null>(null);
    const [selectedRows, setSelectedRows] = useState(new Set<string>());

    const columns = ['Наименование', 'Характеристики', 'Ед. изм.', 'Количество'];

    const handleItemsChange = (newItems: PositionRow[]) => {
        onItemsChange(newItems);
    };

    const addPosition = () => {
        const newItems = [...items, { id: makeId(), name: '', specifications: '', unit: 'шт.', quantity: '' }];
        handleItemsChange(newItems);
    };

    const removeSelectedPositions = () => {
        const newItems = items.filter(item => !selectedRows.has(item.id));
        handleItemsChange(newItems);
        setSelectedRows(new Set());
        setSelection(null);
        setActiveCell(null);
    };

    const handleRowCheckboxChange = (rowId: string, checked: boolean) => {
        const newSelected = new Set(selectedRows);
        if (checked) newSelected.add(rowId);
        else newSelected.delete(rowId);
        setSelectedRows(newSelected);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedRows(new Set(items.map(i => i.id)));
        else setSelectedRows(new Set());
    };

    const getCellValue = useCallback((row: number, col: number): string | number => {
        const item = items[row];
        if (!item) return '';
        switch (col) {
            case 0: return item.name;
            case 1: return item.specifications;
            case 2: return item.unit;
            case 3: return item.quantity;
            default: return '';
        }
    }, [items]);

    const getSelectionRange = useCallback(() => {
        if (!selection) return null;
        const { start, end } = selection;
        return {
            minRow: Math.min(start.row, end.row),
            maxRow: Math.max(start.row, end.row),
            minCol: Math.min(start.col, end.col),
            maxCol: Math.max(start.col, end.col),
        };
    }, [selection]);

    const handleCellUpdate = (row: number, col: number, value: any) => {
        if (row >= items.length) return;
        const newItems = [...items];
        const item = newItems[row];
        if (!item) return;

        switch (col) {
            case 0: item.name = value; break;
            case 1: item.specifications = value; break;
            case 2: item.unit = value; break;
            case 3: item.quantity = value; break;
        }
        handleItemsChange(newItems);
    };

    const clearSelectionContent = useCallback(() => {
        const range = getSelectionRange();
        if (!range || editingCell) return;
        const newItems = [...items];
        for (let r = range.minRow; r <= range.maxRow; r++) {
            for (let c = range.minCol; c <= range.maxCol; c++) {
                if (c === 2) continue; // Don't clear dropdowns
                const item = newItems[r];
                if (!item) continue;
                switch (c) {
                    case 0: item.name = ''; break;
                    case 1: item.specifications = ''; break;
                    case 3: item.quantity = ''; break;
                }
            }
        }
        handleItemsChange(newItems);
    }, [getSelectionRange, items, handleItemsChange, editingCell]);

    const handleRangePaste = useCallback(async () => {
        if (!activeCell) return;
        try {
            const text = await navigator.clipboard.readText();
            const pastedRows = text.split(/\r?\n/).filter(r => r.trim() !== '');
            const grid = pastedRows.map(r => r.split(/\t|;/));

            const newItems = JSON.parse(JSON.stringify(items));
            let maxRow = newItems.length;

            grid.forEach((rowVals, ri) => {
                const targetRow = activeCell.row + ri;
                if (targetRow >= maxRow) { 
                    newItems.push({ id: makeId(), name: '', specifications: '', unit: 'шт.', quantity: '' });
                    maxRow++;
                }
                rowVals.forEach((val, ci) => {
                    const targetCol = activeCell.col + ci;
                    if (targetCol < columns.length) {
                        const item = newItems[targetRow];
                        switch (targetCol) {
                            case 0: item.name = val; break;
                            case 1: item.specifications = val; break;
                            case 2: item.unit = units.find(u => u.label === val || u.value === val)?.value || val; break;
                            case 3: item.quantity = val; break;
                        }
                    }
                });
            });
            handleItemsChange(newItems);
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
        }
    }, [activeCell, items, columns.length, handleItemsChange]);

    const handleRangeCopy = useCallback(() => {
        const range = getSelectionRange();
        if (!range || editingCell) return;
        let copyText = '';
        for (let r = range.minRow; r <= range.maxRow; r++) {
            const rowValues: any[] = [];
            for (let c = range.minCol; c <= range.maxCol; c++) {
                const value = getCellValue(r, c);
                if (c === 2) {
                    rowValues.push(units.find(u => u.value === value)?.label || value);
                } else {
                    rowValues.push(value);
                }
            }
            copyText += rowValues.join('\t');
            if (r < range.maxRow) copyText += '\n';
        }
        navigator.clipboard.writeText(copyText).catch(err => console.error('Could not copy: ', err));
    }, [getSelectionRange, getCellValue, editingCell]);

    const handleRangeCut = useCallback(() => {
        handleRangeCopy();
        clearSelectionContent();
    }, [handleRangeCopy, clearSelectionContent]);

    const handleMouseDown = (e: React.MouseEvent, row: number, col: number) => {
        if (e.button === 2) {
            const range = getSelectionRange();
            if (range && row >= range.minRow && row <= range.maxRow && col >= range.minCol && col <= range.maxCol) {
                return;
            }
        }
        setIsSelecting(true);
        setSelection({ start: { row, col }, end: { row, col } });
        setActiveCell({ row, col });
        setEditingCell(null);
        containerRef.current?.focus();
    };

    const handleMouseOver = (row: number, col: number) => {
        if (isSelecting || isFilling) {
            setSelection(prev => prev ? { ...prev, end: { row, col } } : null);
        }
    };

    const applyFill = useCallback(() => {
        const currentRange = getSelectionRange();
        if (!currentRange || !fillSourceSelection) return;
    
        const sourceRange = {
            minRow: Math.min(fillSourceSelection.start.row, fillSourceSelection.end.row),
            maxRow: Math.max(fillSourceSelection.start.row, fillSourceSelection.end.row),
            minCol: Math.min(fillSourceSelection.start.col, fillSourceSelection.end.col),
            maxCol: Math.max(fillSourceSelection.start.col, fillSourceSelection.end.col),
        };
    
        const newItems = JSON.parse(JSON.stringify(items));
        let itemsModified = false;
    
        for (let r = currentRange.minRow; r <= currentRange.maxRow; r++) {
            for (let c = currentRange.minCol; c <= currentRange.maxCol; c++) {
                const isInSource = r >= sourceRange.minRow && r <= sourceRange.maxRow && c >= sourceRange.minCol && c <= sourceRange.maxCol;
    
                if (!isInSource) {
                    const sourcePatternHeight = sourceRange.maxRow - sourceRange.minRow + 1;
                    const sourcePatternWidth = sourceRange.maxCol - sourceRange.minCol + 1;
    
                    const sourceRow = sourceRange.minRow + ((r - sourceRange.minRow) % sourcePatternHeight);
                    const sourceCol = sourceRange.minCol + ((c - sourceRange.minCol) % sourcePatternWidth);
                    
                    const sourceValue = getCellValue(sourceRow, sourceCol);
    
                    if (r >= newItems.length) {
                        newItems.push({ id: makeId(), name: '', specifications: '', unit: 'шт.', quantity: '' });
                    }
                    const item = newItems[r];
                    if (!item || c === 2) continue;
    
                    switch (c) {
                        case 0: item.name = sourceValue as string; break;
                        case 1: item.specifications = sourceValue as string; break;
                        case 3: item.quantity = sourceValue; break;
                    }
                    itemsModified = true;
                }
            }
        }
    
        if (itemsModified) {
            handleItemsChange(newItems);
        }
    }, [getSelectionRange, fillSourceSelection, items, getCellValue, handleItemsChange]);

    const handleMouseUp = useCallback(() => {
        if (isFilling) {
            applyFill();
        }
        setIsFilling(false);
        setFillSourceSelection(null);
        setIsSelecting(false);
    }, [isFilling, applyFill]);

    const handleDoubleClick = (row: number, col: number) => {
        if (col === 2) return; // Disable double click for unit dropdown
        setSelection(null);
        setEditingCell({ row, col });
        setActiveCell({ row, col });
    };

    const handleContextMenu = (e: React.MouseEvent, row: number, col: number) => {
        e.preventDefault();
        const range = getSelectionRange();
        if (!range || !(row >= range.minRow && row <= range.maxRow && col >= range.minCol && col <= range.maxCol)) {
            handleMouseDown(e, row, col);
        }
        setContextMenu({ x: e.clientX, y: e.clientY, row, col });
    };

    useEffect(() => {
        const body = document.body;
        if (isFilling) {
            body.style.userSelect = 'none';
        } else {
            body.style.userSelect = 'auto';
        }
        return () => {
            body.style.userSelect = 'auto';
        };
    }, [isFilling]);

    // Auto-scroll page logic
    useEffect(() => {
        if (!isSelecting && !isFilling) return;

        const scrollZone = 40, scrollSpeed = 15;
        let animationFrameId: number | null = null;

        const scrollLoop = () => {
            const { y } = mousePosRef.current;
            let scrollY = 0;

            if (y < scrollZone) scrollY = -scrollSpeed;
            else if (y > window.innerHeight - scrollZone) scrollY = scrollSpeed;

            if (scrollY !== 0) {
                window.scrollBy(0, scrollY);
            }
            
            animationFrameId = requestAnimationFrame(scrollLoop);
        };

        const handleGlobalMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
            if (isSelecting || isFilling) {
                const element = document.elementFromPoint(e.clientX, e.clientY);
                const cell = element?.closest('td[data-row][data-col]');
                if (cell) {
                    const row = parseInt(cell.getAttribute('data-row')!, 10);
                    const col = parseInt(cell.getAttribute('data-col')!, 10);
                    if (!isNaN(row) && !isNaN(col)) {
                        setSelection(prev => prev ? { ...prev, end: { row, col } } : null);
                    }
                }
            }
        };

        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        animationFrameId = requestAnimationFrame(scrollLoop);

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isSelecting, isFilling, handleMouseUp]);

    // Global click outside handler
    useEffect(() => {
        const handleGlobalClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setSelection(null);
                setActiveCell(null);
                setEditingCell(null);
            }
            if (contextMenu) {
                setContextMenu(null);
            }
        };
        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, [contextMenu]);

    const handlePaste = (e: React.ClipboardEvent) => {
        if (editingCell) return;
        e.preventDefault();
        handleRangePaste();
    };

    const handleCopy = (e: React.ClipboardEvent) => {
        if (editingCell) return;
        e.preventDefault();
        handleRangeCopy();
    };

    const handleCut = (e: React.ClipboardEvent) => {
        if (editingCell) return;
        e.preventDefault();
        handleRangeCut();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (editingCell) return; // If already editing, let the EditableCell's input handle it.

        if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
            e.preventDefault();
            clearSelectionContent();
            return;
        }

        if (activeCell) {
            if (e.key === 'F2') {
                e.preventDefault();
                setEditingCell(activeCell);
                return;
            }
            // Check for printable characters to start editing, replacing content.
            if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
                e.preventDefault();
                // For columns other than 'unit', start editing by replacing the content.
                if (activeCell.col !== 2) {
                    handleCellUpdate(activeCell.row, activeCell.col, e.key);
                    setEditingCell(activeCell);
                }
            }
        }
    };

    const selectionStyle = useMemo((): React.CSSProperties => {
        if (!selection || !tableRef.current) return { display: 'none' };
        const range = getSelectionRange()!;
        const startCell = tableRef.current.querySelector(`[data-row='${range.minRow}'][data-col='${range.minCol}']`) as HTMLElement;
        const endCell = tableRef.current.querySelector(`[data-row='${range.maxRow}'][data-col='${range.maxCol}']`) as HTMLElement;
        if (!startCell || !endCell) return { display: 'none' };

        const style: React.CSSProperties = {
            position: 'absolute',
            left: startCell.offsetLeft,
            top: startCell.offsetTop,
            width: (endCell.offsetLeft + endCell.offsetWidth) - startCell.offsetLeft -1,
            height: (endCell.offsetTop + endCell.offsetHeight) - startCell.offsetTop -1,
            pointerEvents: 'none',
            zIndex: 15,
        };
        if (!isFilling) {
            style.border = '2px solid #F97316';
        }
        return style;
    }, [selection, isFilling]);

    const activeCellStyle = useMemo((): React.CSSProperties => {
        if (!activeCell || !tableRef.current || selection) return { display: 'none' };
        const cell = tableRef.current.querySelector(`[data-row='${activeCell.row}'][data-col='${activeCell.col}']`) as HTMLElement;
        if (!cell) return { display: 'none' };

        return {
            position: 'absolute',
            left: cell.offsetLeft,
            top: cell.offsetTop,
            width: cell.offsetWidth - 1,
            height: cell.offsetHeight - 1,
            pointerEvents: 'none',
            zIndex: 14,
            border: '2px solid #F97316',
        };
    }, [activeCell, selection]);

    return (
        <div 
            ref={containerRef} 
            tabIndex={-1} 
            className="space-y-4 outline-none"
            onCopy={handleCopy}
            onPaste={handlePaste}
            onCut={handleCut}
            onKeyDown={handleKeyDown}
        >
            <div className="flex items-center gap-3">
                <button onClick={addPosition} className="px-4 py-2 border border-dashed border-gray-300 rounded-md">+ Добавить позицию</button>
                {selectedRows.size > 0 && (
                    <button onClick={removeSelectedPositions} className="px-4 py-2 bg-red-600 text-white rounded-md">Удалить выбранные ({selectedRows.size})</button>
                )}
            </div>
            <div className="relative border border-gray-300 rounded-lg overflow-x-auto p-1">
                <div style={selectionStyle} className={isFilling ? 'selection-border-animated' : ''} />
                <div style={activeCellStyle} />
                
                 {selection && (
                    <div
                        className="absolute w-2 h-2 bg-orange-600 border border-white cursor-crosshair"
                        style={{
                          left: (selectionStyle.left as number) + (selectionStyle.width as number) - 4,
                          top: (selectionStyle.top as number) + (selectionStyle.height as number) - 4,
                          zIndex: 20,
                          pointerEvents: 'auto'
                        }}
                        onMouseDown={() => {
                            setIsFilling(true);
                            setFillSourceSelection(selection);
                        }}
                    />
                  )}
                
                <table ref={tableRef} className="min-w-full text-sm select-none table-fixed border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th className="border border-gray-300 p-2 text-center bg-gray-50" style={{ width: '50px' }}>
                                <input type="checkbox" onChange={(e) => handleSelectAll(e.target.checked)} checked={items.length > 0 && selectedRows.size === items.length} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                            </th>
                            {columns.map((col, i) => <th key={i} className="border border-gray-300 p-2 text-left font-semibold text-gray-600 bg-gray-50" style={{width: i === 0 ? '300px' : (i === 1 ? '300px' : (i === 2 ? '150px' : '150px'))}}>{col}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, rowIndex) => (
                            <tr key={item.id} className="odd:bg-white even:bg-gray-50">
                                <td className="border border-gray-300 p-2 text-center">
                                    <input type="checkbox" checked={selectedRows.has(item.id)} onChange={(e) => handleRowCheckboxChange(item.id, e.target.checked)} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                                </td>
                                <td
                                    data-row={rowIndex}
                                    data-col={0}
                                    className={`border border-gray-300 p-0 relative`}
                                    onMouseDown={(e) => handleMouseDown(e, rowIndex, 0)}
                                    onMouseOver={() => handleMouseOver(rowIndex, 0)}
                                    onDoubleClick={() => handleDoubleClick(rowIndex, 0)}
                                    onContextMenu={(e) => handleContextMenu(e, rowIndex, 0)}
                                >
                                    <EditableCell
                                        value={getCellValue(rowIndex, 0)}
                                        isEditing={editingCell?.row === rowIndex && editingCell?.col === 0}
                                        onUpdate={(value) => handleCellUpdate(rowIndex, 0, value)}
                                        onStopEditing={() => setEditingCell(null)}
                                    />
                                </td>
                                <td
                                    data-row={rowIndex}
                                    data-col={1}
                                    className={`border border-gray-300 p-0 relative`}
                                    onMouseDown={(e) => handleMouseDown(e, rowIndex, 1)}
                                    onMouseOver={() => handleMouseOver(rowIndex, 1)}
                                    onDoubleClick={() => handleDoubleClick(rowIndex, 1)}
                                    onContextMenu={(e) => handleContextMenu(e, rowIndex, 1)}
                                >
                                    <EditableCell
                                        value={getCellValue(rowIndex, 1)}
                                        isEditing={editingCell?.row === rowIndex && editingCell?.col === 1}
                                        onUpdate={(value) => handleCellUpdate(rowIndex, 1, value)}
                                        onStopEditing={() => setEditingCell(null)}
                                    />
                                </td>
                                <td 
                                    data-row={rowIndex}
                                    data-col={2}
                                    className="border border-gray-300 p-0 relative"
                                    onMouseDown={(e) => handleMouseDown(e, rowIndex, 2)}
                                    onMouseOver={() => handleMouseOver(rowIndex, 2)}
                                    onContextMenu={(e) => handleContextMenu(e, rowIndex, 2)}
                                >
                                    <select
                                        value={item.unit}
                                        onChange={(e) => handleCellUpdate(rowIndex, 2, e.target.value)}
                                        className="w-full h-full p-2 bg-transparent border-0 outline-none appearance-none cursor-pointer"
                                    >
                                        {units.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                    </select>
                                </td>
                                <td
                                    data-row={rowIndex}
                                    data-col={3}
                                    className={`border border-gray-300 p-0 relative`}
                                    onMouseDown={(e) => handleMouseDown(e, rowIndex, 3)}
                                    onMouseOver={() => handleMouseOver(rowIndex, 3)}
                                    onDoubleClick={() => handleDoubleClick(rowIndex, 3)}
                                    onContextMenu={(e) => handleContextMenu(e, rowIndex, 3)}
                                >
                                    <EditableCell
                                        value={getCellValue(rowIndex, 3)}
                                        isEditing={editingCell?.row === rowIndex && editingCell?.col === 3}
                                        onUpdate={(value) => handleCellUpdate(rowIndex, 3, value)}
                                        onStopEditing={() => setEditingCell(null)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {contextMenu && (
                <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
                    <ContextMenuItem onClick={() => { handleRangeCut(); setContextMenu(null); }}>Вырезать</ContextMenuItem>
                    <ContextMenuItem onClick={() => { handleRangeCopy(); setContextMenu(null); }}>Копировать</ContextMenuItem>
                    <ContextMenuItem onClick={() => { handleRangePaste(); setContextMenu(null); }}>Вставить</ContextMenuItem>
                </ContextMenu>
            )}
        </div>
    );
};

interface EditableCellProps {
    value: string | number | null | undefined;
    isEditing: boolean;
    onUpdate: (value: string) => void;
    onStopEditing: () => void;
}
const EditableCell: React.FC<EditableCellProps> = ({ value, isEditing, onUpdate, onStopEditing }) => {
    const [currentValue, setCurrentValue] = useState(value?.toString() || '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setCurrentValue(value?.toString() || ''); }, [value]);
    
    useEffect(() => { 
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
     }, [isEditing]);

    const handleBlur = () => { onUpdate(currentValue); onStopEditing(); };
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            (e.target as HTMLElement).blur();
        } else if (e.key === 'Escape') {
            setCurrentValue(value?.toString() || ''); // Revert changes
            onStopEditing();
        }
    };

    if (isEditing) {
        return <input 
            ref={inputRef} 
            type="text" 
            value={currentValue} 
            onChange={(e) => setCurrentValue(e.target.value)} 
            onBlur={handleBlur} 
            onKeyDown={handleKeyDown} 
            className="absolute inset-0 w-full h-full p-2 box-border border-2 border-red-600 outline-none z-20" 
        />;
    }
    
    return <div className="w-full h-full p-2 truncate">{(value != null && value !== '') ? String(value) : <span className="text-gray-400"></span>}</div>;
};

type ContextMenuProps = { x: number; y: number; onClose: () => void; children: React.ReactNode; };
const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, children }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return <div ref={menuRef} className="fixed z-50 bg-white border border-gray-300 rounded-md shadow-lg py-1" style={{ top: y, left: x }}>{children}</div>;
};

const ContextMenuItem: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
    <button onClick={onClick} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{children}</button>
);
