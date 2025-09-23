'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SkeletonLoader from '../components/SkeletonLoader';
import Notification, { NotificationProps } from '../components/Notification';

const API_BASE_URL = 'https://kupecbek.cloudpub.ru';

const units = [
  { value: 'шт', label: 'Штук (шт)' },
  { value: 'г', label: 'Грамм (г)' },
  { value: 'кг', label: 'Килограмм (кг)' },
  { value: 'ц', label: 'Центнер (ц)' },
  { value: 'т', label: 'Тонна (т)' },
  { value: 'м', label: 'Метр (м)' },
  { value: 'пог. м', label: 'Погонный метр (пог. м)' },
  { value: 'м²', label: 'Квадратный метр (м²)' },
  { value: 'га', label: 'Гектар (га)' },
  { value: 'мин', label: 'Минута (мин)' },
  { value: 'ч', label: 'Час (ч)' },
  { value: 'дн/сут', label: 'Сутки (дн/сут)' },
  { value: 'мес', label: 'Месяц (мес)' },
  { value: 'год', label: 'Год (г)' },
  { value: 'л', label: 'Литр (л)' },
  { value: 'см³', label: 'Кубический сантиметр (см³)' },
  { value: 'м³', label: 'Кубический метр (м³)' },
  { value: 'дм³', label: 'Кубический дециметр (дм³)' },
];

// ---------------- Types ----------------
type RowKind = 'metal' | 'generic';

type Supplier = {
  id: number;
  short_name: string;
  inn: string;
  category?: string | null;
  email?: string | null;
};
type MetalRow = {
  _id: string;
  kind: 'metal';
  mCategory?: string; // Категория (лист/труба…)
  size?: string;      // "1x1x1"
  gost?: string;
  grade?: string;
  allowAnalogs?: boolean;
  qty?: string;
  unit?: string;
  comment?: string;
};

type GenericRow = {
  _id: string;
  name?: string;
  dims?: string;  // размеры/характеристики
  unit?: string;   // ед. изм.
  qty?: string;
  allowAnalogs?: boolean;
  comment?: string;
};

type Row = MetalRow | GenericRow;

type OptionsPack = {
  categories: string[];
  grades: string[];
  standards: string[];
};

type SavedMetalItem = {
  id: string;
  kind: 'metal';
  category?: string | null;
  size?: string | null;           // показываем в таблице
  state_standard?: string | null;
  stamp?: string | null;
  quantity: number | null;
  unit?: string | null;
  allow_analogs: boolean;
  comment?: string | null;
};

type SavedGenericItem = {
  id: string;
  kind: 'generic';
  category: string; // пользовательская категория
  name: string;
  dims?: string | null; // размеры/характеристики
  unit?: string | null;  // ед. изм.
  quantity: number | null;
  allow_analogs: boolean;
  comment: string;
};

type SavedItem = SavedMetalItem | SavedGenericItem;

type CategoryBlock = {
  id: string;
  title: string;        // ввод пользователя ("Металлопрокат" или любое другое)
  kind: RowKind;        // вычисляется из title: "Металлопрокат" => metal, иначе generic
  editors: Row[];       // незасейвленные позиции
  saved: SavedItem[];   // сохранённые позиции
  editingTitle: boolean;// управляет показом инпута / жирного заголовка + "Изменить"
};

type Counterparty = {
  id: number;
  short_name: string;
  legal_address: string;
  ogrn?: string | null;
  inn: string;
  kpp?: string | null;
  okpo?: string | null;
  okato?: string | null;
  bank_account?: string | null;
  bank_bik?: string | null;
  bank_name?: string | null;
  bank_corr?: string | null;
  director?: string | null;
  phone?: string | null;
  email?: string | null;
};

// Для формы создания, все поля опциональны и строковые
type CounterpartyCreateForm = Partial<Omit<Counterparty, 'id'>>;

// Для ошибок валидации формы
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
  full_name?: string;
  legal_address?: string;
};


type DaDataAddr = { value: string; unrestricted_value?: string };

type HeaderErrors = {
  title?: string;
  deliveryAt?: string;
  address?: string;
  counterparty?: string;
};

type EmailGroup = {
  id: string;
  name: string;
  items: SavedItem[];
  selectedSupplierIds: number[];
  manualEmails: string;
};

type EmailEntry = {
  id: string;
  email: string;
  selectedItemIds: Set<string>;
  supplierId: number | null; // Это поле больше не используется в UI, но оставляем для структуры
};

const clsInput =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:text-gray-500';
const clsInputError =
  'w-full px-3 py-2 border border-red-500 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500';
const clsBtn = 'px-4 py-2 rounded-md';
const th = 'px-3 py-2 text-left text-xs font-semibold text-gray-600';
const td = 'px-3 py-2';

const formatSavedItem = (item: SavedItem) => {
  if (item.kind === 'metal') {
    const m = item as SavedMetalItem;
    const parts = [
      m.category,
      m.size,
      m.stamp,
      m.state_standard,
    ].filter(Boolean).join(', ');
    return `${parts} - ${m.quantity} ${m.unit || 'шт.'}`;
  }
  const g = item as SavedGenericItem;
  const parts = [g.name, g.dims].filter(Boolean).join(', ');
  return `${parts} - ${g.quantity} ${g.unit || 'шт.'}`;
};

const ItemSelectionDropdown = ({ items, selectedIds, onSelectionChange, catKind, disabled }: { items: SavedItem[], selectedIds: Set<string>, onSelectionChange: (ids: Set<string>) => void, catKind: RowKind, disabled?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      onSelectionChange(new Set(items.map(item => item.id)));
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelectedIds = new Set(selectedIds);
    if (checked) {
      newSelectedIds.add(itemId);
    } else {
      newSelectedIds.delete(itemId);
    }
    onSelectionChange(newSelectedIds);
  };

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:text-gray-500"
        disabled={disabled}
      >
        <span>Выбрано {selectedIds.size} из {items.length}</span>
        <svg className="w-4 h-4 ml-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 w-96 max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-2 border-b sticky top-0 bg-white">
            <label className="flex items-center gap-2 text-sm p-1 rounded">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                checked={allSelected}
                onChange={handleSelectAll}
              />
              <span className="font-medium">Выбрать все</span>
            </label>
          </div>
          <div className="space-y-1 p-2">
            {items.map(item => (
              <label key={item.id} className="flex items-center gap-2 text-sm hover:bg-gray-50 p-1 rounded">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  checked={selectedIds.has(item.id)}
                  onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                />
                <span>{formatSavedItem(item)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PreviewItemsTable = ({ items }: { items: SavedItem[] }) => {
  const isMetalOnly = items.every(item => item.kind === 'metal');
  const isGenericOnly = items.every(item => item.kind === 'generic');

  if (isMetalOnly) {
    return (
      <table className="w-full min-w-[600px] text-xs border-collapse">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Категория</th>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Наименование</th>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Размер</th>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">ГОСТ</th>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Марка</th>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Аналоги</th>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Количество</th>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Ед. изм.</th>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Комментарий</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const metalItem = item as SavedMetalItem;
            return (
              <tr key={item.id} className="border-t border-gray-200">
                <td className="p-2 align-top">Металлопрокат</td>
                <td className="p-2 align-top">{metalItem.category || '—'}</td>
                <td className="p-2 align-top">{metalItem.size || '—'}</td>
                <td className="p-2 align-top">{metalItem.state_standard || '—'}</td>
                <td className="p-2 align-top">{metalItem.stamp || '—'}</td>
                <td className="p-2 align-top">{metalItem.allow_analogs ? 'Да' : 'Нет'}</td>
                <td className="p-2 align-top whitespace-nowrap">{metalItem.quantity}</td>
                <td className="p-2 align-top whitespace-nowrap">{metalItem.unit || 'шт.'}</td>
                <td className="p-2 align-top">{metalItem.comment || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  if (isGenericOnly) {
    return (
      <table className="w-full min-w-[500px] text-xs border-collapse">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Наименование</th>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Размеры, характеристики</th>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Аналоги</th>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Ед. изм.</th>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Количество</th>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Комментарий</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const genericItem = item as SavedGenericItem;
            return (
              <tr key={item.id} className="border-t border-gray-200">
                <td className="p-2 align-top">{genericItem.name}</td>
                <td className="p-2 align-top">{genericItem.dims || '—'}</td>
                <td className="p-2 align-top">{genericItem.allow_analogs ? 'Да' : 'Нет'}</td>
                <td className="p-2 align-top whitespace-nowrap">{genericItem.unit || 'шт.'}</td>
                <td className="p-2 align-top whitespace-nowrap">{genericItem.quantity}</td>
                <td className="p-2 align-top">{genericItem.comment || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  return (
    <table className="w-full min-w-[700px] text-xs border-collapse">
      <thead className="bg-gray-100 sticky top-0">
        <tr>
          <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Категория</th>
          <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Наименование</th>
          <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Характеристики</th>
          <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Аналоги</th>
          <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Кол-во</th>
          <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Комментарий</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => {
          if (item.kind === 'metal') {
            const metalItem = item as SavedMetalItem;
            return (
              <tr key={item.id} className="border-t border-gray-200">
                <td className="p-2 align-top">Металлопрокат</td>
                <td className="p-2 align-top">{metalItem.category}</td>
                <td className="p-2 align-top">{[metalItem.size, metalItem.stamp, metalItem.state_standard].filter(Boolean).join(', ')}</td>
                <td className="p-2 align-top">{metalItem.allow_analogs ? 'Да' : 'Нет'}</td>
                <td className="p-2 align-top whitespace-nowrap">{metalItem.quantity} {metalItem.unit || 'шт.'}</td>
                <td className="p-2 align-top">{metalItem.comment || '—'}</td>
              </tr>
            );
          }
          const genericItem = item as SavedGenericItem;
          return (
            <tr key={item.id} className="border-t border-gray-200">
              <td className="p-2 align-top">{genericItem.category}</td>
              <td className="p-2 align-top">{genericItem.name}</td>
              <td className="p-2 align-top">{genericItem.dims || '—'}</td>
              <td className="p-2 align-top">{genericItem.allow_analogs ? 'Да' : 'Нет'}</td>
              <td className="p-2 align-top whitespace-nowrap">{genericItem.quantity} {genericItem.unit || 'шт.'}</td>
              <td className="p-2 align-top">{genericItem.comment || '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default function RequestPage() {
  // ---------------- Header fields ----------------
  const [title, setTitle] = useState('');
  const [deliveryAt, setDeliveryAt] = useState('');
  const [address, setAddress] = useState('');
  const [emailFooter, setEmailFooter] = useState('С уважением, Пользователь!'); // Default value
  const [headerErrors, setHeaderErrors] = useState<HeaderErrors>({});

  const [isLoading, setIsLoading] = useState(true); // Общее состояние загрузки страницы
  // ---------------- Counterparty fields ----------------
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedCp, setSelectedCp] = useState<Counterparty | null>(null);
  const [showCpCreateModal, setShowCpCreateModal] = useState(false);
  const [newCpForm, setNewCpForm] = useState<CounterpartyCreateForm>({});
  const [cpSearchQuery, setCpSearchQuery] = useState('');
  const [cpSuggestions, setCpSuggestions] = useState<Counterparty[]>([]);
  const [cpFocus, setCpFocus] = useState(false);
  const [cpFormErrors, setCpFormErrors] = useState<CounterpartyFormErrors>({});
  const [cpSearchError, setCpSearchError] = useState('');
  // Состояния для подсказок юр. адреса в модальном окне
  const [cpAddrQuery, setCpAddrQuery] = useState('');
  const [cpAddrSugg, setCpAddrSugg] = useState<DaDataAddr[]>([]);
  const [cpAddrFocus, setCpAddrFocus] = useState(false);
  const [cpAddrLoading, setCpAddrLoading] = useState(false);
  const cpAddrAbort = useRef<AbortController | null>(null);
  // Состояния для поиска контрагента в DaData
  const [cpDadataQuery, setCpDadataQuery] = useState('');
  const [cpDadataSugg, setCpDadataSugg] = useState<DaDataParty[]>([]);
  const [cpDadataFocus, setCpDadataFocus] = useState(false);
  const [cpDadataLoading, setCpDadataLoading] = useState(false);
  const cpDadataAbort = useRef<AbortController | null>(null);


  // флаги сохранения адреса
  const [addressSaved, setAddressSaved] = useState(true);
  const [addressDirty, setAddressDirty] = useState(false); // unused
  const [addrLoading, setAddrLoading] = useState(false);

  // DaData
  const [addrQuery, setAddrQuery] = useState('');
  const [addrSugg, setAddrSugg] = useState<DaDataAddr[]>([]);
  const [addrFocus, setAddrFocus] = useState(false); // показываем подсказки только при фокусе
  const addrAbort = useRef<AbortController | null>(null);
  const addrCache = useRef<Map<string, DaDataAddr[]>>(new Map()); // простейший кэш по префиксам

  // ---------------- Options ----------------
  const [opts, setOpts] = useState<OptionsPack>({
    categories: [],
    grades: [],
    standards: [],
  });

  // ---------------- Categories ----------------
  const [cats, setCats] = useState<CategoryBlock[]>([]);
  const [catFocus, setCatFocus] = useState<Record<string, boolean>>({}); // фокус на инпуте категории

  // ---------------- UI State ----------------
  const [showSendModal, setShowSendModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailPreviews, setEmailPreviews] = useState<{recipients: string, header: string, footer: string, items: SavedItem[]}[]>([]);
  // Состояния для модального окна рассылки
  const [sendCategoryEnabled, setSendCategoryEnabled] = useState<Record<string, boolean>>({});
  const [emailGroupsConfig, setEmailGroupsConfig] = useState<Record<string, EmailEntry[]>>({});
  const [sendCategoryOptions, setSendCategoryOptions] = useState<Record<string, Supplier[]>>({});

  const handleOpenSendModal = () => {
    const initialEnabledState: Record<string, boolean> = {};
    const initialEmailGroups: Record<string, EmailEntry[]> = {};

    cats.forEach(cat => {
      if (cat.saved.length > 0) {
        initialEnabledState[cat.id] = true;
        initialEmailGroups[cat.id] = [{
          id: crypto.randomUUID(),
          email: '',
          supplierId: null,
          selectedItemIds: new Set(cat.saved.map(item => item.id)),
        }];
      }
    });

    setSendCategoryEnabled(initialEnabledState);
    setEmailGroupsConfig(initialEmailGroups);
    setShowSendModal(true);
  };

  // Обновление превью писем при изменении данных в модалке
  useEffect(() => {
    if (!showSendModal) {
      return;
    }

    const recipientGroups: Record<string, SavedItem[]> = {};

    const enabledCats = cats.filter(cat => cat.saved.length > 0 && sendCategoryEnabled[cat.id]);

    enabledCats.forEach(cat => {
      const emailEntries = emailGroupsConfig[cat.id] || [];
      emailEntries.forEach(entry => {
        const email = entry.email.trim();
        if (email && entry.selectedItemIds.size > 0) {
          if (!recipientGroups[email]) {
            recipientGroups[email] = [];
          }
          const itemsToSend = cat.saved.filter(item => entry.selectedItemIds.has(item.id));
          recipientGroups[email].push(...itemsToSend);
        }
      });
    });

    const previews = Object.entries(recipientGroups).map(([email, items]) => {
      // Убираем дубликаты, если одна и та же позиция попала в разные категории
      const uniqueItems = Array.from(new Map(items.map(item => [item.id, item])).values());

      const header = `Здравствуйте,\n\nПросим предоставить коммерческое предложение по следующим позициям:`;
      const footer = `
${emailFooter}`;

      return {
        recipients: email,
        header,
        footer,
        items: uniqueItems,
      };
    });

    setEmailPreviews(previews);
  }, [showSendModal, cats, title, selectedCp, sendCategoryEnabled, emailGroupsConfig]);
  const [notifications, setNotifications] = useState<Omit<NotificationProps, 'onDismiss'>[]>([]);

  const handlePreviewChange = (index: number, part: 'header' | 'footer', value: string) => {
    setEmailPreviews(currentPreviews => {
        const newPreviews = [...currentPreviews];
        newPreviews[index] = { ...newPreviews[index], [part]: value };
        return newPreviews;
    });
  };

  const addNotification = (notif: Omit<NotificationProps, 'id' | 'onDismiss'>) => {
    const id = crypto.randomUUID();
    setNotifications(prev => [...prev, { id, ...notif }]);
  };

  const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
  // ------- Init: address from profile & options ------- 
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        // Запускаем все запросы параллельно
        const [addressRes, counterpartiesRes, suppliersRes, categoriesRes, stampsRes, gostsRes, footerRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/users/me/address`, { credentials: 'include' }).catch(() => null),
          fetch(`${API_BASE_URL}/api/v1/counterparties`, { credentials: 'include' }).catch(() => null),
          fetch(`${API_BASE_URL}/api/v1/suppliers/my`, { credentials: 'include' }).catch(() => null),
          fetch(`${API_BASE_URL}/api/v1/categories`, { credentials: 'include' }).catch(() => null),
          fetch(`${API_BASE_URL}/api/v1/stamps`, { credentials: 'include' }).catch(() => null),
          fetch(`${API_BASE_URL}/api/v1/gosts`, { credentials: 'include' }).catch(() => null),
          fetch(`${API_BASE_URL}/api/v1/users/me/footer`, { credentials: 'include' }).catch(() => null),
        ]);

        // Обрабатываем результаты
        if (addressRes && addressRes.ok) {
          const data = await addressRes.json();
          if (data?.delivery_address !== undefined) {
            setAddress(data.delivery_address || '');
            setAddressSaved(true);
          }
        }

        if (counterpartiesRes && counterpartiesRes.ok) {
          setCounterparties(await counterpartiesRes.json());
        }
        if (suppliersRes && suppliersRes.ok) {
          setSuppliers(await suppliersRes.json());
        }

        const [catData, stpData, gstData, footerData] = await Promise.all([
          categoriesRes && categoriesRes.ok ? categoriesRes.json() : [],
          stampsRes && stampsRes.ok ? stampsRes.json() : [],
          gostsRes && gostsRes.ok ? gostsRes.json() : [],
          footerRes && footerRes.ok ? footerRes.json() : { email_footer: 'С уважением, Пользователь!' },
        ]);

        if (footerRes && footerRes.ok) {
            setEmailFooter(footerData.email_footer || 'С уважением, Пользователь!');
        }

        setOpts({
          categories: catData ?? [],
          grades: stpData ?? [],
          standards: gstData ?? [],
        });

        setOpts({
          categories: catData ?? [],
          grades: stpData ?? [],
          standards: gstData ?? [],
        });

      } catch (error) {
        console.error("Failed to load initial data:", error);
      } finally {
        setIsLoading(false); // Снимаем флаг загрузки в любом случае
      }
    };

    loadInitialData();
  }, []);

  // ------- helpers ------- 
  const fetchSuggest = async (q: string) => {
    // кэш по префиксу: ищем самое длинное совпадение
    const keys = Array.from(addrCache.current.keys()).sort((a,b)=>b.length-a.length);
    const cachedKey = keys.find(k => q.startsWith(k));
    if (cachedKey) {
      const cached = addrCache.current.get(cachedKey)!;
      // фильтруем под текущий запрос
      const f = cached.filter(s => (s.unrestricted_value || s.value).toLowerCase().includes(q.toLowerCase()));
      if (f.length) return f;
    }

    addrAbort.current?.abort();
    addrAbort.current = new AbortController();
    setAddrLoading(true);
    try {
      const url = `${API_BASE_URL}/api/v1/suggest/address?q=${encodeURIComponent(q)}&count=7`;
      const r = await fetch(url, { credentials: 'include', signal: addrAbort.current.signal, keepalive: true as any });
      const data = await r.json();
      const list: DaDataAddr[] = (data?.suggestions ?? []).map((s: any) => ({ value: s.value, unrestricted_value: s.unrestricted_value }));
      addrCache.current.set(q, list);
      return list;
    } catch {
      return [] as DaDataAddr[];
    } finally {
      setAddrLoading(false);
    }
  };

  // Получаем список поставщиков, подходящих по категории у текущего покупателя
  const fetchSuppliersByCategory = async (category: string): Promise<Supplier[]> => {
    if (!category || !category.trim()) return [];
    try {
      const url = `${API_BASE_URL}/api/v1/suppliers/by-category?category=${encodeURIComponent(category)}`;
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data as Supplier[] : [];
    } catch (e) {
      return [];
    }
  };

  // ------- DaData helpers для юр. адреса (аналогично основному) ------- 
  const fetchCpSuggest = async (q: string) => {
    // Используем тот же кэш, что и для основного адреса
    const keys = Array.from(addrCache.current.keys()).sort((a,b)=>b.length-a.length);
    const cachedKey = keys.find(k => q.startsWith(k));
    if (cachedKey) {
      const cached = addrCache.current.get(cachedKey)!;
      const f = cached.filter(s => (s.unrestricted_value || s.value).toLowerCase().includes(q.toLowerCase()));
      if (f.length) return f;
    }

    cpAddrAbort.current?.abort();
    cpAddrAbort.current = new AbortController();
    setCpAddrLoading(true);
    try {
      const url = `${API_BASE_URL}/api/v1/suggest/address?q=${encodeURIComponent(q)}&count=5`;
      const r = await fetch(url, { credentials: 'include', signal: cpAddrAbort.current.signal });
      const data = await r.json();
      const list: DaDataAddr[] = (data?.suggestions ?? []).map((s: any) => ({ value: s.value, unrestricted_value: s.unrestricted_value }));
      addrCache.current.set(q, list); // Пополняем общий кэш
      return list;
    } catch { return []; } 
    finally { setCpAddrLoading(false); }
  };

  // ------- DaData helpers для поиска организаций ------- 
  const fetchPartySuggest = async (q: string) => {
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
  };

  useEffect(() => {
    const fetchAllCategorySuppliers = async () => {
      const uniqueCategories = [...new Set(cats.map(c => c.title.trim()).filter(Boolean))];
      const promises = uniqueCategories.map(catTitle => 
        fetchSuppliersByCategory(catTitle).then(suppliers => ({ [catTitle]: suppliers }))
      );
      const results = await Promise.all(promises);
      const suppliersMap = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      
      const finalMap: Record<string, Supplier[]> = {};
      cats.forEach(cat => {
        finalMap[cat.id] = suppliersMap[cat.title.trim()] || [];
      });
      setSendCategoryOptions(finalMap);
    };

    if (cats.length > 0) {
      fetchAllCategorySuppliers();
    }
  }, [cats]);
  useEffect(() => {
    const q = addrQuery.trim();
    if (!addrFocus || q.length < 3) { if (!addrFocus) setAddrSugg([]); return; }

    const t = setTimeout(async () => {
      const list = await fetchSuggest(q);
      setAddrSugg(list);
    }, 100);
    return () => clearTimeout(t);
  }, [addrQuery, addrFocus]);

  // prefetch на фокусе, если текст уже есть
  useEffect(() => {
    if (addrFocus) {
      const q = (address || '').trim();
      if (q.length >= 3) {
        fetchSuggest(q).then(setAddrSugg);
      }
    }
  }, [addrFocus]);

  // ------- CP Address suggestions (debounce 100ms) ------- 
  useEffect(() => {
    const q = cpAddrQuery.trim();
    if (!cpAddrFocus || q.length < 3) { if (!cpAddrFocus) setCpAddrSugg([]); return; }

    const t = setTimeout(async () => {
      const list = await fetchCpSuggest(q);
      setCpAddrSugg(list);
    }, 150); // чуть больше задержка, т.к. это не основное поле

    return () => clearTimeout(t);
  }, [cpAddrQuery, cpAddrFocus]);

  const persistAddress = async (value: string) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/v1/users/me/address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ delivery_address: value }),
      });
      setAddrLoading(false); // Снимаем состояние загрузки после ответа
      if (r.ok) {
        setAddressSaved(true);
        setAddress(value); // Убедимся, что состояние address соответствует сохраненному
      }
    } catch { /* ignore */ } 
  };

  const onPickAddress = (val: string) => {
    setAddress(val);
    setAddrQuery('');
    setAddrSugg([]);
    setAddressSaved(false); // Адрес изменен, теперь его нужно сохранить 
  };

  const onBlurAddress = () => {
    setAddrFocus(false);
    // Автоматическое сохранение при потере фокуса убрано по запросу
  };

  // Кнопка "Сохранить" 

  const onSaveAddressClick = async () => {
    await persistAddress(address);
  };

  const clearAddress = async () => {
    setAddress('');
    setAddrQuery(''); // Очищаем запрос для подсказок
    setAddrSugg([]); // Очищаем подсказки
    setAddressSaved(false); // Поле очищено, теперь его нужно сохранить (пустым)
  };

  // ------- Counterparty helpers ------- 
  const validateCpForm = (): boolean => {
    const errors: CounterpartyFormErrors = {};
    // Обязательные поля (сделано аналогично валидации поставщика)
    if (!newCpForm.short_name || newCpForm.short_name.length < 2) errors.short_name = 'Обязательное поле';
    if (!newCpForm.legal_address || newCpForm.legal_address.length < 3) errors.legal_address = 'Обязательное поле';
    if (!newCpForm.inn) {
      errors.inn = 'Обязательное поле';
    } else if (!/^\d{10}(\d{2})?$/.test(newCpForm.inn)) {
      errors.inn = 'ИНН должен состоять из 10 или 12 цифр';
    }

    // Теперь остальные поля тоже обязательны и валидируются по шаблонам
    if (!newCpForm.ogrn) {
      errors.ogrn = 'Обязательное поле';
    } else if (!/^\d{13}(\d{2})?$/.test(newCpForm.ogrn)) {
      errors.ogrn = 'ОГРН: 13 или 15 цифр';
    }

    if (newCpForm.kpp && !/^\d{9}$/.test(newCpForm.kpp)) {
      errors.kpp = 'КПП: 9 цифр';
    }

    if (!newCpForm.okpo) {
      errors.okpo = 'Обязательное поле';
    } else if (!/^\d{8}(\d{2})?$/.test(newCpForm.okpo)) {
      errors.okpo = 'ОКПО: 8 или 10 цифр';
    }

    if (!newCpForm.okato) {
      errors.okato = 'Обязательное поле';
    } else if (!/^\d{8,15}$/.test(newCpForm.okato)) {
      errors.okato = 'ОКАТО/ОКТМО: от 8 до 15 цифр';
    }

    // Банковские реквизиты не обязательны, но если заполнены - валидируются
    if (newCpForm.bank_account && !/^\d{20}$/.test(newCpForm.bank_account)) {
      errors.bank_account = 'Расчётный счёт: 20 цифр';
    }

    if (newCpForm.bank_bik && !/^\d{9}$/.test(newCpForm.bank_bik)) {
      errors.bank_bik = 'БИК: 9 цифр';
    }

    if (newCpForm.bank_corr && !/^\d{20}$/.test(newCpForm.bank_corr)) {
      errors.bank_corr = 'Корр. счёт: 20 цифр';
    }

    if (newCpForm.bank_name && (newCpForm.bank_name || '').trim().length < 2) {
      errors.bank_name = 'Наименование банка: мин. 2 символа';
    }

    // Контактная информация
    if (!newCpForm.director || (newCpForm.director || '').trim().length < 2) {
      errors.director = 'Обязательное поле';
    }

    if (!newCpForm.phone) {
      errors.phone = 'Обязательное поле';
    } else if (!/^\+?[0-9\s\-()]{5,}$/.test(newCpForm.phone)) {
      errors.phone = 'Некорректный телефон';
    }

    if (!newCpForm.email) {
      errors.email = 'Обязательное поле';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCpForm.email)) {
      errors.email = 'Некорректный e-mail';
    }

    setCpFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

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
      setNewCpForm(p => ({ ...p, phone: val }));
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

    setNewCpForm(p => ({ ...p, phone: formattedValue }));
  } else {
    setNewCpForm(p => ({ ...p, [field]: val }));
  }
};


  const handleCreateCounterparty = async () => {
    if (!validateCpForm()) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/counterparties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        credentials: 'include',
        body: JSON.stringify(newCpForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Не удалось создать контрагента');
      }
      const createdCp: Counterparty = await res.json();
      setCounterparties(prev => [...prev, createdCp]);
      setSelectedCp(createdCp);
      setShowCpCreateModal(false);
      setNewCpForm({}); // Сбрасываем форму после успеха
      setCpSearchQuery('');
      setCpSearchError('');
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Ошибка создания контрагента', message: e.message });
    }
  };

  const handlePickDadataParty = (party: DaDataParty) => {
    // Заполняем всю форму данными из DaData
    setNewCpForm({
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
    setCpFormErrors({}); // Сбрасываем ошибки, т.к. заполнили заново
  };

  const handlePickCpAddress = (val: string) => {
    handleCpFormChange('legal_address', val);
    setCpAddrQuery(val);
    setCpAddrSugg([]);
  };

  const handleSelectCp = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const cp = counterparties.find(c => c.id === Number(val));
    if (cp) {
      setSelectedCp(cp);
      setCpSearchQuery(`${cp.short_name} (ИНН: ${cp.inn})`);
      setCpSuggestions([]);
    }
  };

  // Поиск контрагента
  useEffect(() => {
    if (cpSearchQuery.length > 1 && cpFocus) {
      const query = cpSearchQuery.toLowerCase();
      setCpSuggestions(counterparties.filter(cp => cp.short_name.toLowerCase().includes(query) || cp.inn.includes(query)));
    } else {
      setCpSuggestions([]);
    }
  }, [cpSearchQuery, counterparties, cpFocus]);
  // ------- Category helpers ------- 
  const addCategory = () =>
    setCats(cs => [
      ...cs,
      { id: crypto.randomUUID(), title: '', kind: 'generic', editors: [], saved: [], editingTitle: true }
    ]);

  const finalizeCategoryTitle = (cid: string, title: string) => {
    setCats(cs => cs.map(c => {
      if (c.id !== cid) return c;
      const normalized = title.trim().toLowerCase();
      const nextKind: RowKind = normalized === 'металлопрокат' ? 'metal' : 'generic';
      return { ...c, title, kind: nextKind, editingTitle: false, editors: [] };
    }));
  };

  const reopenCategoryTitle = (cid: string) =>
    setCats(cs => cs.map(c => c.id === cid ? { ...c, editingTitle: true } : c));

  const addPosition = (cid: string) =>
    setCats(cs => cs.map(c => c.id === cid ? { ...c, editors: [...c.editors, blankRow(c.kind)] } : c));

  const setCell = (cid: string, rid: string, key: string, val: any) =>
    setCats(cs => cs.map(c => {
      if (c.id !== cid) return c;
      return { ...c, editors: c.editors.map(r => r._id === rid ? ({ ...r, [key]: val }) as Row : r) };
    }));

  const removeEditorRow = (cid: string, rid: string) =>
    setCats(cs => cs.map(c => c.id === cid ? { ...c, editors: c.editors.filter(r => r._id !== rid) } : c));

  function blankRow(kind: RowKind): Row {
    return kind === 'metal'
      ? ({ _id: crypto.randomUUID(), kind: 'metal' } as MetalRow)
      : ({ _id: crypto.randomUUID(), kind: 'generic' } as GenericRow);
  }

  // ------- Save single position into category.saved (and hide editor row) ------- 
  const savePosition = (cid: string, rid: string) =>
    setCats(cs => cs.map(c => {
      if (c.id !== cid) return c;
      const row = c.editors.find(r => r._id === rid);
      if (!row) return c;
      let item: SavedItem | null = null;

      if (c.kind === 'metal') {
        const m = row as MetalRow;
        if (!m.mCategory || !m.qty) {
          addNotification({ type: 'warning', title: 'Неполные данные', message: 'Укажите Категорию и Количество.' });
          return c;
        }
        item = {
          id: crypto.randomUUID(),
          kind: 'metal',
          category: m.mCategory || null,
          size: m.size || null,
          state_standard: m.gost || null,
          stamp: m.grade || null,
          quantity: m.qty ? Number(m.qty) : null,
          unit: m.unit || null,
          allow_analogs: !!m.allowAnalogs,
          comment: m.comment || null,
        };
      } else { // generic
        const g = row as GenericRow;
        if (!g.name || !g.qty) {
          addNotification({ type: 'warning', title: 'Неполные данные', message: 'Укажите Наименование и Количество.' });
          return c;
        }
        item = {
          id: crypto.randomUUID(),
          kind: 'generic',
          category: c.title?.trim() || 'Прочее', // пользовательская категория
          name: g.name || '',
          dims: g.dims || null,
          unit: g.unit || null,
          quantity: g.qty ? Number(g.qty) : null,
          allow_analogs: !!g.allowAnalogs,
          comment: g.comment || '',
        };
      }

      return {
        ...c,
        saved: [...c.saved, item!],
        editors: c.editors.filter(r => r._id !== rid)
      };
    }));

  // ------- Whole request save ------- 
  const allSavedItems = useMemo(() => cats.flatMap(c => c.saved), [cats]);

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

    if (!allSavedItems.length) {
      addNotification({ type: 'warning', title: 'Пустая заявка', message: 'Добавьте и сохраните хотя бы одну позицию, чтобы продолжить.' });
      if (!isHeaderValid) {
        addNotification({ type: 'warning', title: 'Неполные данные', message: 'Заполните обязательные поля в шапке заявки.' });
      }
      return null; // Возвращаем null, если валидация не пройдена или нет позиций
    }
    if (!isHeaderValid) {
      addNotification({ type: 'warning', title: 'Неполные данные', message: 'Заполните обязательные поля в шапке заявки.' });
      return null; // Возвращаем null, если валидация не пройдена
    }
    setIsSubmitting(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/v1/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: allSavedItems,
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
      const savedRequest: Request = await r.json();
      addNotification({ type: 'success', title: 'Заявка сохранена', message: 'Ее можно посмотреть в Личном кабинете.' });
      
      return savedRequest; // Возвращаем сохраненную заявку
    } catch (e:any) {
      addNotification({ type: 'error', title: 'Ошибка сохранения', message: e.message || 'Произошла неизвестная ошибка.' });
      return null;
    } finally {
      setIsSubmitting(false);
      // Do not close modal on save, only on send
    }
  };

  const sendRequest = async () => {
    // 1. Сначала сохраняем заявку, чтобы получить её ID
    const savedRequest = await saveRequest();
    if (!savedRequest) {
      return;
    }
  
    // 2. Собираем данные для отправки
    const enabledCats = cats.filter(c => c.saved.length > 0 && sendCategoryEnabled[c.id]);
  
    if (enabledCats.length === 0) {
      addNotification({ type: 'warning', title: 'Никто не выбран', message: 'Выберите хотя бы одну категорию для отправки.' });
      return;
    }
  
    // Группируем получателей и их данные
    const recipientData = new Map<string, { items: Set<SavedItem>, header: string, footer: string, supplierIds: Set<number> }>();

    emailPreviews.forEach(preview => {
        recipientData.set(preview.recipients, {
            items: new Set(preview.items),
            header: preview.header,
            footer: preview.footer,
            supplierIds: new Set(),
        });
    });

    // Добавляем ID поставщиков
    enabledCats.forEach(cat => {
      const emailEntries = emailGroupsConfig[cat.id] || [];
      emailEntries.forEach(entry => {
        const email = entry.email.trim();
        if (email && entry.supplierId && recipientData.has(email)) {
          recipientData.get(email)!.supplierIds.add(entry.supplierId);
        }
      });
    });

    const groupsPayload = Array.from(recipientData.entries()).map(([email, data]) => {
        const items = Array.from(data.items);
        const supplierIds = Array.from(data.supplierIds);
        // Создаем уникальный ключ группы на основе email
        const group_key = `group_${email}`;
        // Собираем названия категорий для этой группы
        const category_titles = [...new Set(items.map(i => i.kind === 'metal' ? (i as SavedMetalItem).category : (i as SavedGenericItem).category).filter(Boolean))] as string[];

        return {
            group_key,
            category_titles,
            supplier_ids: supplierIds,
            manual_emails: [email],
            items: items,
            email_header: data.header,
            email_footer: data.footer,
        };
    });
  
    if (groupsPayload.length === 0) {
      addNotification({ type: 'warning', title: 'Нет получателей', message: 'Укажите e-mail для отправки хотя бы в одной категории.' });
      return;
    }
  
    setIsSubmitting(true);
    try {
      const sendRes = await fetch(`${API_BASE_URL}/api/v1/requests/${(savedRequest as any).id}/send-to-suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ groups: groupsPayload }),
      });
  
      if (!sendRes.ok) {
        const errJson = await sendRes.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Не удалось разослать заявку поставщикам');
      }
  
      const result = await sendRes.json();
      addNotification({ type: 'success', title: 'Заявка отправлена', message: result.message || 'Заявка успешно разослана выбранным поставщикам.' });

      setCats([]);
      setTitle('');
      setDeliveryAt('');
      setSelectedCp(null);
      setCpSearchQuery('');
      setEmailGroupsConfig({});
      setSendCategoryEnabled({});
      setShowSendModal(false);
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Ошибка отправки', message: e.message || String(e) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addEmailEntry = (catId: string) => {
    setEmailGroupsConfig(prev => ({
      ...prev,
      [catId]: [
        ...(prev[catId] || []),
        {
          id: crypto.randomUUID(),
          email: '',
          supplierId: null,
          selectedItemIds: new Set(cats.find(c => c.id === catId)?.saved.map(item => item.id) || []),
        }
      ]
    }));
  };

  const removeEmailEntry = (catId: string, entryId: string) => {
    setEmailGroupsConfig(prev => ({
      ...prev,
      [catId]: (prev[catId] || []).filter(entry => entry.id !== entryId),
    }));
  };

  const updateEmailEntry = (catId: string, entryId: string, field: keyof EmailEntry, value: any) => {
    setEmailGroupsConfig(prev => ({
      ...prev,
      [catId]: (prev[catId] || []).map(entry =>
        entry.id === entryId ? { ...entry, [field]: value } : entry
      ),
    }));
  };


  // ---------------- Render ----------------
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

        <div className="container mx-auto px-4 py-8 space-y-6">

          {/* ---- Шапка заявки ---- */}
          <div className="bg-white rounded-xl shadow p-5">
            {isLoading ? (
              // --- Скелетон для шапки ---
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="space-y-1"><SkeletonLoader className="h-5 w-32" /><SkeletonLoader className="h-10 w-full" /></div>
                  <div className="space-y-1"><SkeletonLoader className="h-5 w-40" /><SkeletonLoader className="h-10 w-full" /></div>
                  <div className="space-y-1"><SkeletonLoader className="h-5 w-28" /><SkeletonLoader className="h-10 w-full" /></div>
                  <div className="space-y-1"><SkeletonLoader className="h-5 w-24" /><SkeletonLoader className="h-10 w-full" /></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <SkeletonLoader className="h-10 w-28" />
                  <SkeletonLoader className="h-10 w-28" />
                </div>
              </>
            ) : (
              // --- Реальный контент шапки --- 
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Название заявки*</label>
                    <input
                      className={headerErrors.title ? clsInputError : clsInput}
                      value={title}
                      onChange={(e) => { setTitle(e.target.value); if (headerErrors.title) setHeaderErrors(p => ({ ...p, title: undefined })); }}
                      placeholder="Например: Поставка на объект А"
                    />
                    {headerErrors.title && <p className="text-xs text-red-600 mt-1">{headerErrors.title}</p>}
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Дата поставки*</label>
                    <input
                      type="date"
                      className={headerErrors.deliveryAt ? clsInputError : clsInput}
                      value={deliveryAt}
                      onChange={(e) => { setDeliveryAt(e.target.value); if (headerErrors.deliveryAt) setHeaderErrors(p => ({ ...p, deliveryAt: undefined })); }}
                    />
                    {headerErrors.deliveryAt && <p className="text-xs text-red-600 mt-1">{headerErrors.deliveryAt}</p>}
                  </div>

                  {/* Адрес */}
                  <div className="lg:col-span-1 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Адрес поставки</label>
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <input
                          className={`${headerErrors.address ? clsInputError : clsInput} w-full`}
                          value={address}
                          onFocus={()=>{
                            setAddrFocus(true);
                            setAddrQuery(address);
                          }}
                          onBlur={onBlurAddress}
                          onChange={(e)=>{
                            setAddress(e.target.value);
                            setAddrQuery(e.target.value);
                            setAddressSaved(false);
                            if (headerErrors.address) setHeaderErrors(p => ({ ...p, address: undefined }));
                          }}
                          placeholder="Начните вводить адрес..."
                          disabled={addressSaved && address.length > 0} // Поле disabled, если адрес сохранен и не пуст
                        />
                        {headerErrors.address && <p className="text-xs text-red-600 mt-1">{headerErrors.address}</p>}
                        {addrFocus && addrSugg.length > 0 && (
                          <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow">
                            {addrSugg.map((s, i) => (
                              <button
                                type="button"
                                key={i}
                                onMouseDown={() => onPickAddress(s.unrestricted_value || s.value)}
                                className="block w-full text-left px-3 py-2 hover:bg-amber-50"
                              >
                                {s.unrestricted_value || s.value}
                              </button>
                            ))}
                            {addrLoading && <div className="px-3 py-2 text-xs text-gray-500">Загрузка...</div>}
                            {addrSugg.length === 0 && !addrLoading && addrQuery.length >= 3 && <div className="px-3 py-2 text-xs text-gray-500">Ничего не найдено</div>}
                          </div>
                        )}
                      </div>

                      {addressSaved && address.length > 0 ? (
                        <button type="button" onClick={clearAddress} className="px-3 py-2 border border-gray-300 rounded-md whitespace-nowrap">Очистить</button>
                      ) : (
                        <button
                          type="button"
                          onClick={onSaveAddressClick}
                          className={`px-3 py-2 rounded-md whitespace-nowrap ${address.trim().length === 0 ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-amber-600 text-white'}`}
                          disabled={address.trim().length === 0 || addrLoading}
                        >
                          {addrLoading ? 'Сохранение...' : 'Сохранить'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ---- Блок выбора контрагента ---- */}
                  <div className="lg:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Контрагент*</label>
                    <div className="flex items-start gap-3">
                      <div className="relative flex-grow">
                        <input
                          className={headerErrors.counterparty ? clsInputError : clsInput}
                          placeholder="Начните вводить ИНН или название для поиска..."
                          value={cpSearchQuery}
                          onChange={e => { setCpSearchQuery(e.target.value); setSelectedCp(null); if (headerErrors.counterparty) setHeaderErrors(p => ({ ...p, counterparty: undefined })); }}
                          onFocus={() => setCpFocus(true)}
                          onBlur={() => setTimeout(() => setCpFocus(false), 150)}
                        />
                        {headerErrors.counterparty && <p className="text-xs text-red-600 mt-1">{headerErrors.counterparty}</p>}
                        {cpSuggestions.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow">
                            {cpSuggestions.map(cp => (
                              <button
                                type="button"
                                key={cp.id}
                                onMouseDown={() => handleSelectCp({ target: { value: String(cp.id) } } as any)}
                                className="block w-full text-left px-3 py-2 hover:bg-amber-50"
                              >
                                {cp.short_name} (ИНН: {cp.inn})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => setShowCpCreateModal(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-md whitespace-nowrap">
                        + Добавить
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={saveRequest} disabled={isSubmitting} className={`bg-amber-600 text-white ${clsBtn} disabled:opacity-50`}>{isSubmitting ? 'Сохранение...' : 'Сохранить'}</button>
                  <button type="button" onClick={handleOpenSendModal} disabled={isSubmitting || allSavedItems.length === 0} className={`border border-amber-600 text-amber-700 ${clsBtn} disabled:opacity-50`}>Разослать</button>
                </div>
              </>
            )}
          </div>

          {/* ---- Модальное окно создания контрагента ---- */}
          {showCpCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl p-6 space-y-4 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-semibold">Новый контрагент</h3>
                
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
                        <button type="button" key={i} onMouseDown={() => handlePickDadataParty(p)} className="block w-full text-left px-3 py-2 hover:bg-amber-50 text-sm">
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
                    <input className={cpFormErrors.short_name ? clsInputError : clsInput} placeholder="ООО Ромашка" value={newCpForm.short_name || ''} onChange={e => handleCpFormChange('short_name', e.target.value)} />
                    {cpFormErrors.short_name && <p className="text-xs text-red-600 mt-1">{cpFormErrors.short_name}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <div className="relative">
                      <label className="text-xs text-gray-600">Юридический адрес*</label>
                      <input
                        className={cpFormErrors.legal_address ? clsInputError : clsInput}
                        placeholder="Начните вводить юр. адрес..."
                        value={newCpForm.legal_address || ''}
                        onFocus={() => { setCpAddrFocus(true); setCpAddrQuery(newCpForm.legal_address || ''); }}
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
                            <button type="button" key={i} onMouseDown={() => handlePickCpAddress(s.unrestricted_value || s.value)} className="block w-full text-left px-3 py-2 hover:bg-amber-50 text-sm">
                              {s.unrestricted_value || s.value}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">ИНН*</label>
                    <input className={cpFormErrors.inn ? clsInputError : clsInput} placeholder="10 или 12 цифр" value={newCpForm.inn || ''} onChange={e => handleCpFormChange('inn', e.target.value)} />
                    {cpFormErrors.inn && <p className="text-xs text-red-600 mt-1">{cpFormErrors.inn}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">ОГРН*</label>
                    <input className={cpFormErrors.ogrn ? clsInputError : clsInput} placeholder="13 или 15 цифр" value={newCpForm.ogrn || ''} onChange={e => handleCpFormChange('ogrn', e.target.value)} />
                    {cpFormErrors.ogrn && <p className="text-xs text-red-600 mt-1">{cpFormErrors.ogrn}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">КПП*</label>
                    <input className={cpFormErrors.kpp ? clsInputError : clsInput} placeholder="9 цифр" value={newCpForm.kpp || ''} onChange={e => handleCpFormChange('kpp', e.target.value)} />
                    {cpFormErrors.kpp && <p className="text-xs text-red-600 mt-1">{cpFormErrors.kpp}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">ОКПО*</label>
                    <input className={cpFormErrors.okpo ? clsInputError : clsInput} placeholder="8 или 10 цифр" value={newCpForm.okpo || ''} onChange={e => handleCpFormChange('okpo', e.target.value)} />
                    {cpFormErrors.okpo && <p className="text-xs text-red-600 mt-1">{cpFormErrors.okpo}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">ОКАТО/ОКТМО*</label>
                    <input className={cpFormErrors.okato ? clsInputError : clsInput} value={newCpForm.okato || ''} onChange={e => handleCpFormChange('okato', e.target.value)} />
                    {cpFormErrors.okato && <p className="text-xs text-red-600 mt-1">{cpFormErrors.okato}</p>}
                  </div>
                </div>

                {/* Банк */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                  <h4 className="md:col-span-3 text-md font-semibold text-gray-800">Банковские реквизиты</h4>
                  <div>
                    <label className="text-xs text-gray-600">Расчётный счёт</label>
                    <input className={cpFormErrors.bank_account ? clsInputError : clsInput} placeholder="20 цифр" value={newCpForm.bank_account || ''} onChange={e => handleCpFormChange('bank_account', e.target.value)} />
                    {cpFormErrors.bank_account && <p className="text-xs text-red-600 mt-1">{cpFormErrors.bank_account}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">БИК банка</label>
                    <input className={cpFormErrors.bank_bik ? clsInputError : clsInput} placeholder="9 цифр" value={newCpForm.bank_bik || ''} onChange={e => handleCpFormChange('bank_bik', e.target.value)} />
                    {cpFormErrors.bank_bik && <p className="text-xs text-red-600 mt-1">{cpFormErrors.bank_bik}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Наименование банка</label>
                    <input className={cpFormErrors.bank_name ? clsInputError : clsInput} placeholder="ПАО Сбербанк" value={newCpForm.bank_name || ''} onChange={e => handleCpFormChange('bank_name', e.target.value)} />
                    {cpFormErrors.bank_name && <p className="text-xs text-red-600 mt-1">{cpFormErrors.bank_name}</p>}
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-gray-600">Корр. счёт</label>
                    <input className={cpFormErrors.bank_corr ? clsInputError : clsInput} placeholder="20 цифр" value={newCpForm.bank_corr || ''} onChange={e => handleCpFormChange('bank_corr', e.target.value)} />
                    {cpFormErrors.bank_corr && <p className="text-xs text-red-600 mt-1">{cpFormErrors.bank_corr}</p>}
                  </div>
                </div>

                {/* Контактная информация */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                  <h4 className="md:col-span-3 text-md font-semibold text-gray-800">Контактная информация</h4>
                  <div>
                    <label className="text-xs text-gray-600">ФИО директора*</label>
                    <input className={cpFormErrors.director ? clsInputError : clsInput} placeholder="Иванов И.И." value={newCpForm.director || ''} onChange={e => handleCpFormChange('director', e.target.value)} />
                    {cpFormErrors.director && <p className="text-xs text-red-600 mt-1">{cpFormErrors.director}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Телефон*</label>
                    <input className={cpFormErrors.phone ? clsInputError : clsInput} placeholder="+7 (999) 999-99-99" value={newCpForm.phone || ''} onChange={e => handleCpFormChange('phone', e)} />
                    {cpFormErrors.phone && <p className="text-xs text-red-600 mt-1">{cpFormErrors.phone}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">E-mail*</label>
                    <input className={cpFormErrors.email ? clsInputError : clsInput} placeholder="contact@company.ru" value={newCpForm.email || ''} onChange={e => handleCpFormChange('email', e.target.value)} />
                    {cpFormErrors.email && <p className="text-xs text-red-600 mt-1">{cpFormErrors.email}</p>}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <button onClick={handleCreateCounterparty} className="px-4 py-2 bg-emerald-600 text-white rounded-md">
                    Сохранить контрагента
                  </button>
                  <button onClick={() => {
                    setShowCpCreateModal(false);
                    setNewCpForm({});
                    setCpFormErrors({});
                  }} className="px-4 py-2 border border-gray-300 rounded-md">
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---- Модальное окно подтверждения рассылки ---- */}
          {showSendModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl p-6 space-y-4 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-semibold">Подтверждение рассылки</h3>
                <p>Выберите, какие категории рассылать, и укажите поставщика для каждой категории.</p>

                {/* Список категорий с чекбоксами и селектом поставщика */}
                <div className="space-y-3">
                  {cats.filter(c => c.saved.length > 0).map(cat => {
                    const enabled = !!sendCategoryEnabled[cat.id];
                    const emailEntries = emailGroupsConfig[cat.id] || [];
                    const options = suppliers;

                    return (
                      <div key={cat.id} className="flex items-start gap-3 p-3 border rounded-md">
                        <div className="pt-1">
                          <input type="checkbox" checked={enabled} onChange={() => setSendCategoryEnabled(prev => ({ ...prev, [cat.id]: !enabled }))} />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{cat.title}</div>
                            <div className="text-sm text-gray-500">{cat.saved.length} позиций</div>
                          </div>
                          {emailEntries.map((entry, index) => (
                            <div key={entry.id} className={`p-3 rounded-md ${index > 0 ? 'mt-2' : ''} bg-gray-50`}>
                              {/* Для первой строки показываем выбор поставщика */}
                              {index === 0 && (
                                <div className="mb-3">
                                  <label className="text-xs text-gray-600">Поставщик (необязательно)</label>
                                  <select
                                    className={clsInput}
                                    value={entry.supplierId ?? ''}
                                    onChange={(e) => {
                                      const supplierId = e.target.value ? Number(e.target.value) : null;
                                      const supplier = options.find(s => s.id === supplierId);
                                      updateEmailEntry(cat.id, entry.id, 'supplierId', supplierId);
                                      updateEmailEntry(cat.id, entry.id, 'email', supplier?.email || '');
                                    }}
                                    disabled={!enabled}
                                  >
                                    <option value="">Выбрать из списка моих поставщиков...</option>
                                    {options.map(s => (
                                      <option key={s.id} value={s.id}>{s.short_name}{s.inn ? ` (ИНН: ${s.inn})` : ''}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Компактная строка для email и позиций */}
                              <div className="flex flex-wrap items-end gap-3">
                                <div className="flex-grow min-w-[250px]">
                                  <label className="text-xs text-gray-600">
                                    {index === 0 ? 'E-mail поставщика или вручную' : 'Дополнительный E-mail'}
                                  </label>
                                  <input
                                    className={clsInput}
                                    placeholder="contact@company.ru"
                                    value={entry.email}
                                    readOnly={index === 0 && entry.supplierId !== null}
                                    onChange={(e) => {
                                      if (index === 0 && entry.supplierId !== null) return;
                                      updateEmailEntry(cat.id, entry.id, 'email', e.target.value);
                                    }}
                                    disabled={!enabled}
                                  />
                                </div>
                                <div className="flex-shrink-0 w-full sm:w-auto">
                                  <label className="text-xs text-gray-600">Позиции</label>
                                  <ItemSelectionDropdown
                                    items={cat.saved}
                                    selectedIds={entry.selectedItemIds}
                                    onSelectionChange={(ids) => updateEmailEntry(cat.id, entry.id, 'selectedItemIds', ids)}
                                    catKind={cat.kind}
                                    disabled={!enabled}
                                  />
                                </div>
                                {emailEntries.length > 1 ? (
                                   <button
                                      type="button"
                                      onClick={() => removeEmailEntry(cat.id, entry.id)}
                                      className="px-3 py-2 text-red-600 hover:text-red-800 disabled:text-gray-400 self-end"
                                      title="Удалить получателя"
                                      disabled={!enabled}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                      </svg>
                                    </button>
                                ) : <div className="w-11"/> }
                              </div>
                            </div>
                          ))}
                          <button type="button" onClick={() => addEmailEntry(cat.id)} className="text-sm text-emerald-600 hover:text-emerald-700" disabled={!enabled}>+ Добавить еще email</button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Preview сообщения */}
                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-semibold">Предпросмотр писем</h4>
                  {emailPreviews.map((preview, index) => (
                    <div key={index} className="border p-3 rounded-md space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Получатель: <span className="font-normal text-gray-900">{preview.recipients}</span>
                      </label>
                      
                      <div>
                        <label className="text-xs text-gray-600">Шапка письма</label>
                        <textarea
                          className="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm focus:ring-amber-500 focus:border-amber-500"
                          rows={4}
                          value={preview.header}
                          onChange={(e) => handlePreviewChange(index, 'header', e.target.value)}
                        />
                      </div>

                      <div className="p-3 border rounded-md bg-gray-50/70">
                        <p className="text-xs text-gray-600 mb-2">Позиции заявки (нередактируемые)</p>
                        <div className="max-h-48 overflow-y-auto text-xs">
                          <PreviewItemsTable items={preview.items} />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-gray-600">Подвал письма</label>
                        <textarea
                          className="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm focus:ring-amber-500 focus:border-amber-500"
                          rows={4}
                          value={preview.footer}
                          onChange={(e) => handlePreviewChange(index, 'footer', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                  {emailPreviews.length === 0 && (
                    <p className="text-sm text-gray-500">Нет выбранных категорий или получателей для отправки.</p>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <button onClick={sendRequest} disabled={isSubmitting || emailPreviews.length === 0} className="px-4 py-2 bg-emerald-600 text-white rounded-md disabled:opacity-50">
                    {isSubmitting ? 'Отправка...' : 'Отправить'}
                  </button>
                  <button onClick={() => setShowSendModal(false)} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50">
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ---- Категории и позиции ---- */}
          {isLoading ? (
            // --- Скелетон для блока категорий ---
            <div className="bg-white rounded-xl shadow p-5 space-y-4">
              <SkeletonLoader className="h-8 w-64" />
              <SkeletonLoader className="h-40 w-full" />
              <SkeletonLoader className="h-10 w-40" />
            </div>
          ) : (cats.map(cat => (
            <div key={cat.id} className="bg-white rounded-xl shadow p-5 space-y-4">
              {/* Заголовок категории: сначала ввод, потом жирный текст + кнопка Изменить */}
              {cat.editingTitle ? (
                <div className="flex items-center gap-3">
                  <div className="relative w-80">
                    <input
                      className="px-2 py-1 border border-gray-300 rounded-md text-sm w-full"
                      value={cat.title}
                      placeholder="Категория (например, Металлопрокат)"
                      onFocus={()=> setCatFocus(p=>({ ...p, [cat.id]: true }))}
                      onBlur={()=> setTimeout(()=> setCatFocus(p=>({ ...p, [cat.id]: false })), 120)}
                      onChange={(e)=> setCats(cs => cs.map(c => c.id===cat.id ? { ...c, title: e.target.value } : c))}
                      onKeyDown={(e)=>{ if (e.key === 'Enter') finalizeCategoryTitle(cat.id, cat.title); }}
                    />
                    {catFocus[cat.id] && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow">
                        <button
                          type="button"
                          onMouseDown={()=> finalizeCategoryTitle(cat.id, 'Металлопрокат')}
                          className="block w-full text-left px-3 py-2 hover:bg-amber-50 text-sm"
                        >
                          Металлопрокат
                        </button>
                      </div>
                    )}
                  </div>
                  <button className="px-3 py-1 bg-emerald-600 text-white rounded-md text-sm" onClick={()=>finalizeCategoryTitle(cat.id, cat.title)}>
                    Применить
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="text-lg font-semibold">
                    {cat.title?.trim() || (cat.kind === 'metal' ? 'Металлопрокат' : 'Новая категория')}
                  </div>
                  <button className="px-3 py-1 border border-gray-300 rounded-md text-sm" onClick={()=>reopenCategoryTitle(cat.id)}>
                    Изменить
                  </button>
                </div>
              )}

              {/* Пока категория не задана — никаких полей ниже */}
              {!cat.editingTitle && (
                <>
                  {/* Если есть сохранённые позиции — показываем таблицу */}
                  {cat.saved.length > 0 && (
                    <div className="space-y-2">
                      {cat.kind === 'metal' ? (
                        <table className="w-full table-auto border-separate border-spacing-0">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className={th}>Категория</th>
                              <th className={th}>Размер</th>
                              <th className={th}>ГОСТ</th>
                              <th className={th}>Марка</th>
                              <th className={th}>Аналоги</th>
                              <th className={th}>Количество</th>
                              <th className={th}>Ед. изм.</th>
                              <th className={th}>Комментарий</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cat.saved.map((s, i) => {
                              if (s.kind !== 'metal') return null;
                              const m = s as SavedMetalItem;
                              return (
                                <tr key={i} className="border-t">
                                  <td className={td}>{m.category || '—'}</td>
                                  <td className={td}>{m.size || '—'}</td>
                                  <td className={td}>{m.state_standard || '—'}</td>
                                  <td className={td}>{m.stamp || '—'}</td>
                                  <td className={td}>{m.allow_analogs ? 'Да' : 'Нет'}</td>
                                  <td className={td}>{m.quantity ?? '—'}</td>
                                  <td className={td}>{m.unit || 'шт.'}</td>
                                  <td className={td}>{m.comment || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <table className="w-full table-auto border-separate border-spacing-0">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className={th}>Наименование</th>
                              <th className={th}>Размеры/характеристики</th>
                              <th className={th}>Аналоги</th>
                              <th className={th}>Ед. изм.</th>
                              <th className={th}>Количество</th>
                              <th className={th}>Комментарий</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cat.saved.map((s, i) => {
                              if (s.kind !== 'generic') return null;
                              const g = s as SavedGenericItem;
                              return (
                                <tr key={i} className="border-t">
                                  <td className={td}>{g.name}</td>
                                  <td className={td}>{g.dims || '—'}</td>
                                  <td className={td}>{g.allow_analogs ? 'Да' : 'Нет'}</td>
                                  <td className={td}>{g.unit || '—'}</td>
                                  <td className={td}>{g.quantity ?? '—'}</td>
                                  <td className={td}>{g.comment || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* Несохранённые редакторы позиций (кнопки под позицией) */}
                  {cat.editors.map(row => (
                    <div key={row._id} className="rounded-lg border border-gray-200 p-4">
                      {cat.kind === 'metal' ? (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-start">
                            <div>
                              <div className="text-xs text-gray-600 mb-1">Категория</div>
                              <select className={clsInput}
                                value={(row as MetalRow).mCategory || ''}
                                onChange={(e)=>setCell(cat.id, row._id, 'mCategory', e.target.value)}>
                                <option value="">—</option>
                                {opts.categories.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <div className="text-xs text-gray-600 mb-1">Размер (1×1×1)</div>
                              <input className={clsInput} placeholder="1x1x1"
                                value={(row as MetalRow).size || ''}
                                onChange={(e)=>setCell(cat.id, row._id, 'size', e.target.value.replace(/ /g, 'x'))} />
                            </div>
                            <div>
                              <div className="text-xs text-gray-600 mb-1">ГОСТ</div>
                              <select className={clsInput}
                                value={(row as MetalRow).gost || ''}
                                onChange={(e)=>setCell(cat.id, row._id, 'gost', e.target.value)}>
                                <option value="">—</option>
                                {opts.standards.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <div className="text-xs text-gray-600 mb-1">Марка</div>
                              <select className={clsInput}
                                value={(row as MetalRow).grade || ''}
                                onChange={(e)=>setCell(cat.id, row._id, 'grade', e.target.value)}>
                                <option value="">—</option>
                                {opts.grades.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <div className="text-xs text-gray-600 mb-1">Аналоги</div>
                              <select className={clsInput}
                                value={(row as MetalRow).allowAnalogs ? 'Да' : 'Нет'}
                                onChange={(e)=>setCell(cat.id, row._id,'allowAnalogs', e.target.value === 'Да')}> 
                                <option>Нет</option>
                                <option>Да</option>
                              </select>
                            </div>
                            <div>
                              <div className="text-xs text-gray-600 mb-1">Количество</div>
                              <input className={clsInput} type="number" min="0" step="any"
                                value={(row as MetalRow).qty || ''}
                                onChange={(e)=>setCell(cat.id, row._id, 'qty', e.target.value)} />
                            </div>
                            <div>
                              <div className="text-xs text-gray-600 mb-1">Ед. изм.</div>
                              <select className={clsInput} value={(row as MetalRow).unit || ''} onChange={(e) => setCell(cat.id, row._id, 'unit', e.target.value)}>
                                <option value="">—</option>
                                {units.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="text-xs text-gray-600 mb-1">Комментарий</div>
                            <input className={clsInput}
                              value={(row as MetalRow).comment || ''}
                              onChange={(e)=>setCell(cat.id, row._id, 'comment', e.target.value)} />
                          </div>
                        </>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                          <div className="md:col-span-2">
                            <div className="text-xs text-gray-600 mb-1">Наименование товаров / работ / услуг</div>
                            <input className={clsInput}
                              value={(row as GenericRow).name || ''}
                              onChange={(e)=>setCell(cat.id, row._id, 'name', e.target.value)} />
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">Размеры, характеристики</div>
                            <input className={clsInput}
                              value={(row as GenericRow).dims || ''}
                              onChange={(e)=>setCell(cat.id, row._id, 'dims', e.target.value)} />
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">Аналоги</div>
                            <select className={clsInput}
                              value={(row as GenericRow).allowAnalogs ? 'Да' : 'Нет'}
                              onChange={(e)=>setCell(cat.id, row._id,'allowAnalogs', e.target.value === 'Да')}>
                              <option>Нет</option>
                              <option>Да</option>
                            </select>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">Ед. изм.</div>
                            <select className={clsInput} value={(row as GenericRow).unit || ''} onChange={(e) => setCell(cat.id, row._id, 'unit', e.target.value)}>
                              <option value="">—</option>
                              {units.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">Количество</div>
                            <input className={clsInput} type="number" min="0" step="any"
                              value={(row as GenericRow).qty || ''}
                              onChange={(e)=>setCell(cat.id, row._id, 'qty', e.target.value)} />
                          </div>
                          <div className="md:col-span-6">
                            <div className="text-xs text-gray-600 mb-1">Комментарий</div>
                            <input className={clsInput}
                              value={(row as GenericRow).comment || ''}
                              onChange={(e)=>setCell(cat.id, row._id, 'comment', e.target.value)} />
                          </div>
                        </div>
                      )}

                      {/* Кнопки под позицией */}
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button onClick={()=>savePosition(cat.id, row._id)} className="px-4 py-2 bg-emerald-600 text-white rounded-md">Сохранить</button>
                        <button onClick={()=>removeEditorRow(cat.id, row._id)} className="px-4 py-2 border border-gray-300 rounded-md">Удалить</button>
                      </div>
                    </div>
                  ))}

                  {/* Кнопка добавить позицию — снизу блока категории */}
                  <div>
                    <button onClick={()=>addPosition(cat.id)} className="px-4 py-2 border border-dashed border-gray-300 rounded-md">
                      + Добавить позицию
                    </button>
                  </div>
                </>
              )}
            </div>
          )))} 

          {/* Кнопка добавить категорию — слева */}
          {isLoading ? (
            // --- Скелетон для кнопки "Добавить категорию" ---
            <div className="flex justify-start">
              <SkeletonLoader className="h-14 w-52" />
            </div>
          ) : (
            // --- Реальная кнопка --- 
            <div className="flex justify-start">
              <button
                type="button"
                onClick={addCategory}
                className="px-5 py-3 border border-dashed border-gray-400 rounded-md text-gray-700 bg-white shadow-sm"
              >
                + Добавить категорию
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}