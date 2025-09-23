'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import SkeletonLoader from '@/app/components/SkeletonLoader';
import Notification, { NotificationProps } from '@/app/components/Notification';

const API_BASE_URL = 'https://kupecbek.cloudpub.ru';

// ─────────── TYPES ─────────── //

// Simplified SavedItem to match RequestItem
// We can reuse this for the modal logic
type SavedItem = {
    id: string; // We'll use the original item ID, converted to string
    kind: 'metal' | 'generic';
    category?: string | null;
    name?: string | null;
    dims?: string | null;
    size?: string | null;
    stamp?: string | null;
    state_standard?: string | null;
    quantity: number | null;
    unit?: string | null;
    comment?: string | null;
    allow_analogs?: boolean;
};

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
  allow_analogs: boolean;
};

type OfferItem = {
  id: number;
  request_item_id: number;
  price: number;
};

// Extended Supplier type for the resend modal
type Supplier = {
  id: number;
  short_name: string;
  inn: string;
  category?: string | null;
  email?: string | null;
};

type Offer = {
  id: number;
  supplier: { id: number; short_name: string; }; // Simplified supplier for offers
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

// Types for the resend modal, adapted from request/page.tsx
type CategoryBlock = {
  id: string;
  title: string;
  kind: 'metal' | 'generic';
  saved: SavedItem[];
};

type MetalEmailEntry = {
  id: string;
  email: string;
  selectedItemIds: Set<string>;
  supplierId: number | null;
};

type EmailPreview = {
  recipients: string;
  header: string;
  footer: string;
  items: SavedItem[];
};

const clsInput =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100 disabled:text-gray-500';

// ─────────── HELPER COMPONENTS ─────────── //

const formatSavedItem = (item: SavedItem) => {
  if (item.kind === 'metal') {
    const parts = [
      item.category,
      item.size,
      item.stamp,
      item.state_standard,
    ].filter(Boolean).join(', ');
    return `${parts} - ${item.quantity} ${item.unit || 'шт.'}`;
  }
  const parts = [item.name, item.dims].filter(Boolean).join(', ');
  return `${parts} - ${item.quantity} ${item.unit || 'шт.'}`;
};

const ItemSelectionDropdown = ({ items, selectedIds, onSelectionChange, catKind, disabled }: { items: SavedItem[], selectedIds: Set<string>, onSelectionChange: (ids: Set<string>) => void, catKind: 'metal' | 'generic', disabled?: boolean }) => {
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
          {items.map(item => (
              <tr key={item.id} className="border-t border-gray-200">
                <td className="p-2 align-top">Металлопрокат</td>
                <td className="p-2 align-top">{item.category || '—'}</td>
                <td className="p-2 align-top">{item.size || '—'}</td>
                <td className="p-2 align-top">{item.state_standard || '—'}</td>
                <td className="p-2 align-top">{item.stamp || '—'}</td>
                <td className="p-2 align-top">{item.allow_analogs ? 'Да' : 'Нет'}</td>
                <td className="p-2 align-top whitespace-nowrap">{item.quantity}</td>
                <td className="p-2 align-top whitespace-nowrap">{item.unit || 'шт.'}</td>
                <td className="p-2 align-top">{item.comment || '—'}</td>
              </tr>
          ))}
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
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Ед. изм.</th>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Количество</th>
            <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Комментарий</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
              <tr key={item.id} className="border-t border-gray-200">
                <td className="p-2 align-top">{item.name}</td>
                <td className="p-2 align-top">{item.dims || '—'}</td>
                <td className="p-2 align-top whitespace-nowrap">{item.unit || 'шт.'}</td>
                <td className="p-2 align-top whitespace-nowrap">{item.quantity}</td>
                <td className="p-2 align-top">{item.comment || '—'}</td>
              </tr>
          ))}
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
          <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Кол-во</th>
          <th className="p-2 font-semibold text-left border-b-2 border-gray-200">Комментарий</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => {
          if (item.kind === 'metal') {
            return (
              <tr key={item.id} className="border-t border-gray-200">
                <td className="p-2 align-top">Металлопрокат</td>
                <td className="p-2 align-top">{item.category}</td>
                <td className="p-2 align-top">{[item.size, item.stamp, item.state_standard].filter(Boolean).join(', ')}</td>
                <td className="p-2 align-top whitespace-nowrap">{item.quantity} {item.unit || 'шт.'}</td>
                <td className="p-2 align-top">{item.comment || '—'}</td>
              </tr>
            );
          }
          return (
            <tr key={item.id} className="border-t border-gray-200">
              <td className="p-2 align-top">{item.category}</td>
              <td className="p-2 align-top">{item.name}</td>
              <td className="p-2 align-top">{item.dims || '—'}</td>
              <td className="p-2 align-top whitespace-nowrap">{item.quantity} {item.unit || 'шт.'}</td>
              <td className="p-2 align-top">{item.comment || '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
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

  // --- Resend Modal State ---
  const [showSendModal, setShowSendModal] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [emailPreviews, setEmailPreviews] = useState<EmailPreview[]>([]);
  const [sendCategoryManual, setSendCategoryManual] = useState<Record<string, string>>({});
  const [sendCategoryEnabled, setSendCategoryEnabled] = useState<Record<string, boolean>>({});
  const [sendCategorySupplier, setSendCategorySupplier] = useState<Record<string, number | null>>({});
  const [metalSendConfig, setMetalSendConfig] = useState<Record<string, MetalEmailEntry[]>>({});
  const [sendCategoryOptions, setSendCategoryOptions] = useState<Record<string, Supplier[]>>({});

  const addNotification = (notif: Omit<NotificationProps, 'id' | 'onDismiss'>) => {
    const notifId = crypto.randomUUID();
    setNotifications(prev => [...prev, { id: notifId, ...notif }]);
  };
  const removeNotification = (notifId: string) => setNotifications(prev => prev.filter(n => n.id !== notifId));

  // --- Data Fetching ---
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

  // Fetch suppliers for the modal
  useEffect(() => {
    async function fetchSuppliers() {
      try {
        const suppliersRes = await fetch(`${API_BASE_URL}/api/v1/suppliers/my`, { credentials: 'include' });
        if (suppliersRes.ok) {
          setSuppliers(await suppliersRes.json());
        }
      } catch (error) {
        console.error("Failed to load suppliers:", error);
      }
    }
    fetchSuppliers();
  }, []);

  // --- Memoized category grouping ---
  const categoryBlocks = useMemo((): CategoryBlock[] => {
    if (!request) return [];

    const categories = new Map<string, RequestItem[]>();
    
    request.items.forEach(item => {
      const categoryName = item.kind === 'metal' ? 'Металлопрокат' : (item.category || 'Прочее');
      
      if (!categories.has(categoryName)) {
        categories.set(categoryName, []);
      }
      categories.get(categoryName)!.push(item);
    });

    return Array.from(categories.entries()).map(([title, items]) => {
      const blockKind = items[0]?.kind || 'generic';

      return {
        id: title,
        title: title,
        kind: blockKind,
        saved: items.map(item => ({ // Convert RequestItem to SavedItem
          id: String(item.id),
          kind: item.kind,
          category: item.category,
          name: item.name,
          dims: item.dims,
          size: item.size,
          stamp: item.stamp,
          state_standard: item.state_standard,
          quantity: item.quantity,
          unit: item.unit || item.uom,
          comment: item.comment,
          allow_analogs: item.allow_analogs,
        })),
      };
    });
  }, [request]);

  // Update email previews when modal data changes
  useEffect(() => {
    if (!showSendModal || !request) {
      return;
    }

    const recipientGroups: Record<string, SavedItem[]> = {};

    const enabledCats = categoryBlocks.filter(cat => sendCategoryEnabled[cat.id]);

    enabledCats.forEach(cat => {
      if (cat.kind === 'metal') {
        const metalEmails = metalSendConfig[cat.id] || [];
        metalEmails.forEach(entry => {
          const email = entry.email.trim();
          if (email && entry.selectedItemIds.size > 0) {
            if (!recipientGroups[email]) {
              recipientGroups[email] = [];
            }
            const itemsToSend = cat.saved.filter(item => entry.selectedItemIds.has(item.id));
            recipientGroups[email].push(...itemsToSend);
          }
        });
      } else {
        const email = (sendCategoryManual[cat.id] || '').trim();
        if (email) {
          if (!recipientGroups[email]) {
            recipientGroups[email] = [];
          }
          recipientGroups[email].push(...cat.saved);
        }
      }
    });

    const previews = Object.entries(recipientGroups).map(([email, items]) => {
      const uniqueItems = Array.from(new Map(items.map(item => [item.id, item])).values());

      const header = `Здравствуйте,\n\nПросим предоставить коммерческое предложение по следующим позициям:`;
      const footer = `\nС уважением,\n${request.counterparty?.short_name || 'Покупатель'}`;

      return {
        recipients: email,
        header,
        footer,
        items: uniqueItems,
      };
    });

    setEmailPreviews(previews);
  }, [showSendModal, categoryBlocks, request, sendCategoryEnabled, sendCategorySupplier, sendCategoryManual, suppliers, sendCategoryOptions, metalSendConfig]);


  // --- Offer Logic ---
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

  // --- Resend Modal Logic ---
  const handleOpenSendModal = () => {
    const initialEnabledState: Record<string, boolean> = {};
    const initialMetalConfig: Record<string, MetalEmailEntry[]> = {};
    const initialManualEmails: Record<string, string> = {};

    categoryBlocks.forEach(cat => {
      if (cat.saved.length > 0) {
        initialEnabledState[cat.id] = true;
        if (cat.kind === 'metal') {
          initialMetalConfig[cat.id] = [{
            id: crypto.randomUUID(),
            email: '',
            supplierId: null,
            selectedItemIds: new Set(cat.saved.map(item => item.id)),
          }];
        } else {
          initialManualEmails[cat.id] = '';
        }
      }
    });

    setSendCategoryEnabled(initialEnabledState);
    setMetalSendConfig(initialMetalConfig);
    setSendCategoryManual(initialManualEmails);
    setShowSendModal(true);
  };

  const sendRequest = async () => {
    if (!request) return;

    const enabledCats = categoryBlocks.filter(c => c.saved.length > 0 && sendCategoryEnabled[c.id]);
  
    if (enabledCats.length === 0) {
      addNotification({ type: 'warning', title: 'Никто не выбран', message: 'Выберите хотя бы одну категорию для отправки.' });
      return;
    }
  
    const recipientData = new Map<string, { items: Set<SavedItem>, header: string, footer: string, supplierIds: Set<number> }>();

    emailPreviews.forEach(preview => {
        recipientData.set(preview.recipients, {
            items: new Set(preview.items),
            header: preview.header,
            footer: preview.footer,
            supplierIds: new Set(),
        });
    });

    enabledCats.forEach(cat => {
        if (cat.kind === 'metal') {
            const metalEmails = metalSendConfig[cat.id] || [];
            metalEmails.forEach(entry => {
                const email = entry.email.trim();
                if (email && entry.supplierId && recipientData.has(email)) {
                    recipientData.get(email)!.supplierIds.add(entry.supplierId);
                }
            });
        } else { // generic
            const supplierId = sendCategorySupplier[cat.id];
            const manualEmail = (sendCategoryManual[cat.id] || '').trim();
            if (manualEmail && supplierId && recipientData.has(manualEmail)) {
                recipientData.get(manualEmail)!.supplierIds.add(supplierId);
            }
        }
    });

    const groupsPayload = Array.from(recipientData.entries()).map(([email, data]) => {
        const items = Array.from(data.items).map(item => ({ ...item, id: Number(item.id) })); // Convert id back to number for API
        const supplierIds = Array.from(data.supplierIds);
        const group_key = `group_${email}`;
        const category_titles = [...new Set(items.map(i => i.kind === 'metal' ? i.category : i.category).filter(Boolean))] as string[];

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
      const sendRes = await fetch(`${API_BASE_URL}/api/v1/requests/${request.id}/send-to-suppliers`, {
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
      setShowSendModal(false);
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Ошибка отправки', message: e.message || String(e) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addMetalEmail = (catId: string) => {
    setMetalSendConfig(prev => ({
      ...prev,
      [catId]: [
        ...(prev[catId] || []),
        {
          id: crypto.randomUUID(),
          email: '',
          supplierId: null,
          selectedItemIds: new Set(categoryBlocks.find(c => c.id === catId)?.saved.map(item => item.id) || []),
        }
      ]
    }));
  };

  const removeMetalEmail = (catId: string, entryId: string) => {
    setMetalSendConfig(prev => ({
      ...prev,
      [catId]: (prev[catId] || []).filter(entry => entry.id !== entryId),
    }));
  };

  const updateMetalEmailEntry = (catId: string, entryId: string, field: keyof MetalEmailEntry, value: any) => {
    setMetalSendConfig(prev => ({
      ...prev,
      [catId]: (prev[catId] || []).map(entry =>
        entry.id === entryId ? { ...entry, [field]: value } : entry
      ),
    }));
  };

  const handlePreviewChange = (index: number, part: 'header' | 'footer', value: string) => {
    setEmailPreviews(currentPreviews => {
        const newPreviews = [...currentPreviews];
        newPreviews[index] = { ...newPreviews[index], [part]: value };
        return newPreviews;
    });
  };

  // --- Render Logic ---
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
      {/* ---- Notifications Container ---- */}
        <div className="fixed top-24 right-5 z-50 w-full max-w-sm space-y-3">
          {notifications.map(notif => (
            <Notification key={notif.id} {...notif} onDismiss={removeNotification} />
          ))}
        </div>

      {/* ---- Resend Modal ---- */}
      {showSendModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl p-6 space-y-4 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-semibold">Подтверждение рассылки</h3>
                <p>Выберите, какие категории рассылать, и укажите поставщика для каждой категории.</p>

                {/* Category list with checkboxes and supplier select */}
                <div className="space-y-3">
                  {categoryBlocks.filter(c => c.saved.length > 0).map(cat => {
                    const enabled = !!sendCategoryEnabled[cat.id];
                    const options = sendCategoryOptions[cat.id] ?? suppliers;

                    if (cat.kind === 'metal') {
                      const emailEntries = metalSendConfig[cat.id] || [];
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
                              <div key={entry.id} className="p-3 bg-gray-50 rounded-md space-y-3">
                                <div>
                                  <label className="text-xs text-gray-600">Поставщик</label>
                                  <select className={clsInput} value={entry.supplierId ?? ''} onChange={(e) => {
                                      const supplierId = e.target.value ? Number(e.target.value) : null;
                                      const supplier = options.find(s => s.id === supplierId);
                                      updateMetalEmailEntry(cat.id, entry.id, 'supplierId', supplierId);
                                      updateMetalEmailEntry(cat.id, entry.id, 'email', supplier?.email || '');
                                    }} disabled={!enabled}>
                                    <option value=''>Выбрать поставщика...</option>
                                    {options.map(s => (
                                      <option key={s.id} value={s.id}>{s.short_name}{s.inn ? ` (ИНН: ${s.inn})` : ''}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                                  <div>
                                    <label className="text-xs text-gray-600">E-mail для отправки</label>
                                    <input
                                      className={clsInput}
                                      placeholder="contact@company.ru"
                                      value={entry.email}
                                      onChange={(e) => updateMetalEmailEntry(cat.id, entry.id, 'email', e.target.value)}
                                      disabled={!enabled}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-600">Позиции</label>
                                    <ItemSelectionDropdown
                                      items={cat.saved}
                                      selectedIds={entry.selectedItemIds}
                                      onSelectionChange={(ids) => updateMetalEmailEntry(cat.id, entry.id, 'selectedItemIds', ids)}
                                      catKind={cat.kind}
                                      disabled={!enabled}
                                    />
                                  </div>
                                </div>
                                {emailEntries.length > 1 && (
                                  <div className="text-right">
                                    <button type="button" onClick={() => removeMetalEmail(cat.id, entry.id)} className="text-red-500 text-sm hover:text-red-700" disabled={!enabled}>Удалить</button>
                                  </div>
                                )}
                              </div>
                            ))}
                            <button type="button" onClick={() => addMetalEmail(cat.id)} className="text-sm text-emerald-600 hover:text-emerald-700" disabled={!enabled}>+ Добавить еще email</button>
                          </div>
                        </div>
                      );
                    }

                    const selectedSupplierId = sendCategorySupplier[cat.id] ?? null;
                    return (
                      <div key={cat.id} className="flex items-start gap-3 p-3 border rounded-md">
                        <div className="pt-1">
                          <input type="checkbox" checked={enabled} onChange={() => setSendCategoryEnabled(prev => ({ ...prev, [cat.id]: !enabled }))} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{cat.title}</div>
                            <div className="text-sm text-gray-500">{cat.saved.length} позиций</div>
                          </div>
                          <div className="mt-2">
                            <select className={clsInput} value={selectedSupplierId ?? ''} onChange={(e) => {
                                const supplierId = e.target.value ? Number(e.target.value) : null;
                                setSendCategorySupplier(prev => ({ ...prev, [cat.id]: supplierId }));
                                const supplier = options.find(s => s.id === supplierId);
                                setSendCategoryManual(prev => ({ ...prev, [cat.id]: supplier?.email || '' }));
                              }} disabled={!enabled}>
                              <option value=''>Выбрать поставщика...</option>
                              {options.map(s => (
                                <option key={s.id} value={s.id}>{s.short_name}{s.inn ? ` (ИНН: ${s.inn})` : ''}</option>
                              ))}
                            </select>
                            <div className="mt-2">
                                <label className="text-xs text-gray-600">E-mail для отправки</label>
                                <input
                                  className={clsInput}
                                  placeholder="contact@company.ru"
                                  value={sendCategoryManual[cat.id] ?? ''}
                                  onChange={(e) => setSendCategoryManual(prev => ({ ...prev, [cat.id]: e.target.value }))}
                                  disabled={!enabled}
                                />
                                <p className="text-xs text-gray-500 mt-1">Email поставщика подставляется автоматически, но вы можете его изменить.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Email Preview */}
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

      <main className="flex-grow container mx-auto px-4 py-8">
        {/* -- Top Block -- */}
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
          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={handleOpenSendModal}
              disabled={request.status === 'awarded' || request.status === 'closed'}
              className="px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Повторно отправить заявку
            </button>
          </div>
        </div>

        {/* -- Items Table -- */}
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

        {/* -- Offers Panel -- */}
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
