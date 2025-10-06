'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import SkeletonLoader from '@/app/components/SkeletonLoader';
import Notification, { NotificationProps } from '@/app/components/Notification'; // Assuming NotificationProps is also exported from here
import { FaDownload, FaFilePdf, FaSpinner } from 'react-icons/fa';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const clsInput = 'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500';
const clsInputError = 'w-full px-3 py-2 border border-red-500 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500';

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
  email: string;
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
  inn: string | null;
  kpp: string | null;
  address: string | null;
  bank_name: string | null;
  bank_bik: string | null;
  bank_corr: string | null;
  bank_account: string | null;
  director: string | null;
};

type RequestDetails = {
  id: string;
  display_id: number;
  comment: string | null;
  delivery_address: string | null;
  delivery_at: string | null;
  created_at: string;
  status: string;
  winner_offer_id: number | null;
  items: RequestItem[];
  offers: Offer[];
  counterparty: Counterparty | null;
  contract_url: string | null;
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

const OfferItemRow = ({ item, requestItem }: { item: OfferItem; requestItem: RequestItem }) => (
  <tr className="border-b border-gray-200 last:border-b-0">
    <td className="py-3 px-4 text-sm text-gray-700">{requestItem.name || requestItem.category}</td>
    <td className="py-3 px-4 text-sm text-gray-700">{requestItem.dims || requestItem.size || '—'}</td>
    <td className="py-3 px-4 text-sm text-gray-700">{requestItem.quantity} {requestItem.unit || 'шт.'}</td>
    <td className="py-3 px-4 text-sm text-gray-700">{item.price} ₽</td>
    <td className="py-3 px-4 text-sm text-gray-700">{requestItem.comment || '—'}</td>
  </tr>
);

// ─────────── MODAL COMPONENTS ─────────── //

type BankDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bankDetails: {
    contactPerson: string;
    bankName: string;
    bankBik: string;
    bankCorrespondentAccount: string;
    bankSettlementAccount: string;
  }) => void;
  initialData: {
    contactPerson: string;
    bankName: string;
    bankBik: string;
    bankCorrespondentAccount: string;
    bankSettlementAccount: string;
  };
};

type BankDetailsFormErrors = {
  contactPerson?: string;
  bankName?: string;
  bankBik?: string;
  bankCorrespondentAccount?: string;
  bankSettlementAccount?: string;
};

const BankDetailsModal = ({ isOpen, onClose, onSave, initialData }: BankDetailsModalProps) => {
  const [contactPerson, setContactPerson] = useState(initialData.contactPerson);
  const [bankName, setBankName] = useState(initialData.bankName);
  const [bankBik, setBankBik] = useState(initialData.bankBik);
  const [bankCorrespondentAccount, setBankCorrespondentAccount] = useState(initialData.bankCorrespondentAccount);
  const [bankSettlementAccount, setBankSettlementAccount] = useState(initialData.bankSettlementAccount);
  const [errors, setErrors] = useState<BankDetailsFormErrors>({});

  useEffect(() => {
    setContactPerson(initialData.contactPerson);
    setBankName(initialData.bankName);
    setBankBik(initialData.bankBik);
    setBankCorrespondentAccount(initialData.bankCorrespondentAccount);
    setBankSettlementAccount(initialData.bankSettlementAccount);
    setErrors({});
  }, [initialData]);

  const validateForm = () => {
    const newErrors: BankDetailsFormErrors = {};
    if (!contactPerson.trim()) newErrors.contactPerson = 'Обязательное поле';
    if (!bankName.trim()) newErrors.bankName = 'Обязательное поле';
    if (!bankBik.trim()) {
      newErrors.bankBik = 'Обязательное поле';
    } else if (!/^\d{9}$/.test(bankBik.trim())) {
      newErrors.bankBik = 'БИК должен состоять из 9 цифр';
    }
    if (!bankCorrespondentAccount.trim()) {
      newErrors.bankCorrespondentAccount = 'Обязательное поле';
    } else if (!/^\d{20}$/.test(bankCorrespondentAccount.trim())) {
      newErrors.bankCorrespondentAccount = 'Корр. счет должен состоять из 20 цифр';
    }
    if (!bankSettlementAccount.trim()) {
      newErrors.bankSettlementAccount = 'Обязательное поле';
    } else if (!/^\d{20}$/.test(bankSettlementAccount.trim())) {
      newErrors.bankSettlementAccount = 'Р/с должен состоять из 20 цифр';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave({ contactPerson, bankName, bankBik, bankCorrespondentAccount, bankSettlementAccount });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 space-y-4 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-semibold text-gray-800">Введите банковские реквизиты</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="modalContactPerson" className="text-xs text-gray-600">Контактное лицо*</label>
            <input
              type="text"
              id="modalContactPerson"
              placeholder="Например: Иванов Иван Иванович"
              className={errors.contactPerson ? clsInputError : clsInput}
              value={contactPerson}
              onChange={(e) => { setContactPerson(e.target.value); setErrors(prev => ({ ...prev, contactPerson: undefined })); }}
            />
            {errors.contactPerson && <p className="text-xs text-red-600 mt-1">{errors.contactPerson}</p>}
          </div>
          <div>
            <label htmlFor="modalBankName" className="text-xs text-gray-600">Название банка*</label>
            <input
              type="text"
              id="modalBankName"
              placeholder="Например: ПАО Сбербанк"
              className={errors.bankName ? clsInputError : clsInput}
              value={bankName}
              onChange={(e) => { setBankName(e.target.value); setErrors(prev => ({ ...prev, bankName: undefined })); }}
            />
            {errors.bankName && <p className="text-xs text-red-600 mt-1">{errors.bankName}</p>}
          </div>
          <div>
            <label htmlFor="modalBankBik" className="text-xs text-gray-600">БИК*</label>
            <input
              type="text"
              id="modalBankBik"
              placeholder="9 цифр"
              className={errors.bankBik ? clsInputError : clsInput}
              value={bankBik}
              onChange={(e) => { setBankBik(e.target.value); setErrors(prev => ({ ...prev, bankBik: undefined })); }} 
            />
            {errors.bankBik && <p className="text-xs text-red-600 mt-1">{errors.bankBik}</p>}
          </div>
          <div>
            <label htmlFor="modalBankCorrespondentAccount" className="text-xs text-gray-600">Корреспондентский счет*</label>
            <input
              type="text"
              id="modalBankCorrespondentAccount"
              className={errors.bankCorrespondentAccount ? clsInputError : clsInput}
              placeholder="20 цифр"
              value={bankCorrespondentAccount}
              onChange={(e) => { setBankCorrespondentAccount(e.target.value); setErrors(prev => ({ ...prev, bankCorrespondentAccount: undefined })); }}
            />
            {errors.bankCorrespondentAccount && <p className="text-xs text-red-600 mt-1">{errors.bankCorrespondentAccount}</p>}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="modalBankSettlementAccount" className="text-xs text-gray-600">Расчетный счет*</label>
            <input
              type="text"
              id="modalBankSettlementAccount"
              className={errors.bankSettlementAccount ? clsInputError : clsInput}
              placeholder="20 цифр"
              value={bankSettlementAccount}
              onChange={(e) => { setBankSettlementAccount(e.target.value); setErrors(prev => ({ ...prev, bankSettlementAccount: undefined })); }}
            />
            {errors.bankSettlementAccount && <p className="text-xs text-red-600 mt-1">{errors.bankSettlementAccount}</p>}
          </div>
          <div className="flex justify-end space-x-4 mt-6 md:col-span-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              Сохранить и продолжить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─────────── MAIN COMPONENT ─────────── //

export default function DealPage() {
  const params = useParams();
  const id = params.id as string;

  const [request, setRequest] = useState<RequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Omit<NotificationProps, 'onDismiss'>[]>([]);

  const [isGeneratingContract, setIsGeneratingContract] = useState(false);
  const [showBankDetailsModal, setShowBankDetailsModal] = useState(false);
  const [bankDetailsFilled, setBankDetailsFilled] = useState(false);
  const [currentAction, setCurrentAction] = useState<'contract' | 'invoice' | null>(null);

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
          throw new Error(err.detail || 'Не удалось загрузить детали сделки');
        }
        const data: RequestDetails = await response.json();
        setRequest(data);
        if (data.counterparty) {
          const bankDetailsResponse = await fetch(`${API_BASE_URL}/api/v1/counterparties/${data.counterparty.id}/has-bank-details`, {
            credentials: 'include',
          });
          if (bankDetailsResponse.ok) {
            const hasBankDetails = await bankDetailsResponse.json();
            setBankDetailsFilled(hasBankDetails);
          } else {
            console.error('Failed to fetch bank details status');
            setBankDetailsFilled(false);
          }
        }
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки');
        addNotification({
          type: 'error',
          title: 'Ошибка',
          message: e.message || 'Произошла ошибка при загрузке данных.',
          duration: 5000,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchRequestDetails();
  }, [id]);

  const handleDocumentAction = async (actionType: 'contract' | 'invoice') => {
    if (!request || !request.counterparty) {
      addNotification({
        type: 'error',
        title: 'Ошибка',
        message: 'Не удалось получить данные контрагента.',
        duration: 5000,
      });
      return;
    }

    setCurrentAction(actionType);

    if (!bankDetailsFilled) {
      addNotification({
        type: 'warning',
        title: 'Внимание',
        message: 'Для генерации договора/счета необходимо заполнить банковские реквизиты.',
        duration: 5000,
      });
      setShowBankDetailsModal(true);
      return;
    }

    if (actionType === 'contract') {
      await generateContract();
    } else if (actionType === 'invoice') {
      addNotification({ 
        type: 'warning',
        title: 'Информация',
        message: 'Функционал генерации счета пока не реализован.',
        duration: 5000,
      });
    }
  };

  const generateContract = async () => {
    if (!request || !request.counterparty) return;

    setIsGeneratingContract(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/contracts/generate/${request.counterparty.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Не удалось сгенерировать договор');
      }

      const data = await response.json();
      window.open(data.file_path, '_blank');
      addNotification({
        type: 'success',
        title: 'Успех',
        message: 'Договор успешно сгенерирован и открыт для скачивания!',
        duration: 5000,
      });
    } catch (e: any) {
      addNotification({
        type: 'error',
        title: 'Ошибка',
        message: e.message || 'Произошла ошибка при генерации договора.',
        duration: 5000,
      });
    } finally {
      setIsGeneratingContract(false);
    }
  };

  const handleSaveBankDetails = async (bankDetails: {
    contactPerson: string;
    bankName: string;
    bankBik: string;
    bankCorrespondentAccount: string;
    bankSettlementAccount: string;
  }) => {
    if (!request || !request.counterparty) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/counterparties/${request.counterparty.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          director: bankDetails.contactPerson,
          bank_name: bankDetails.bankName,
          bank_bik: bankDetails.bankBik,
          bank_corr: bankDetails.bankCorrespondentAccount,
          bank_account: bankDetails.bankSettlementAccount,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Не удалось обновить банковские реквизиты');
      }

      setBankDetailsFilled(true);
      setShowBankDetailsModal(false);
      addNotification({
        type: 'success',
        title: 'Успех',
        message: 'Банковские реквизиты успешно сохранены!',
        duration: 5000,
      });

      if (currentAction === 'contract') {
        await generateContract();
      } else if (currentAction === 'invoice') {
        addNotification({
          type: 'warning',
          title: 'Информация',
          message: 'Функционал генерации счета пока не реализован.',
          duration: 5000,
        });
      }

    } catch (e: any) {
      addNotification({
        type: 'error',
        title: 'Ошибка',
        message: e.message || 'Произошла ошибка при сохранении банковских реквизитов.',
        duration: 5000,
      });
    }
  };

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
          <div className="bg-white rounded-xl shadow p-6 text-center">Сделка не найдена.</div>
        </main>
        <Footer />
      </div>
    );
  }

  const winningOffer = request.offers.find(offer => offer.id === request.winner_offer_id);

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
        {/* -- Верхний блок: Общая информация о сделке -- */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-3xl font-bold text-gray-800">Сделка по заявке №{request.display_id}</h1>
            {getStatusBadge(request.status)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <InfoBlock label="Дата создания заявки" value={new Date(request.created_at).toLocaleDateString('ru-RU')} />
            <InfoBlock label="Адрес доставки" value={request.delivery_address} />
            <InfoBlock label="Контрагент" value={request.counterparty?.short_name} />
            <InfoBlock label="ИНН Контрагента" value={request.counterparty?.inn} />
            <InfoBlock label="Выбранный поставщик" value={winningOffer?.supplier.short_name} />
            <InfoBlock label="Email поставщика" value={winningOffer?.supplier.email} />
            <InfoBlock label="Комментарий к заявке" value={request.comment} />
            <InfoBlock label="Дата и время поставки" value={request.delivery_at ? new Date(request.delivery_at).toLocaleString('ru-RU') : '—'} />
          </div>
        </div>

        {/* -- Детали выбранного предложения -- */}
        {winningOffer && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Выбранное предложение от {winningOffer.supplier.short_name}</h2>
            <div className="overflow-x-auto bg-gray-50 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наименование</th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Характеристики</th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Количество</th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена за ед.</th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Комментарий</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {winningOffer.items.map(offerItem => {
                    const requestItem = request.items.find(ri => ri.id === offerItem.request_item_id);
                    return requestItem ? <OfferItemRow key={offerItem.id} item={offerItem} requestItem={requestItem} /> : null;
                  })}
                </tbody>
              </table>
            </div>
            {winningOffer.comment && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg text-blue-800 text-sm">
                <p className="font-semibold">Комментарий поставщика:</p>
                <p>{winningOffer.comment}</p>
              </div>
            )}
          </div>
        )}

        {/* -- Секция для генерации договора и счета -- */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">Документы по сделке</h2>
          <div className="flex space-x-4">
            <button
              onClick={() => handleDocumentAction('contract')}
              className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isGeneratingContract}
            >
              {isGeneratingContract ? (
                <FaSpinner className="-ml-1 mr-3 h-6 w-6 text-white" />
              ) : (
                <FaFilePdf className="-ml-1 mr-3 h-6 w-6 text-white" />
              )}
              Скачать договор
            </button>
            <button
              onClick={() => handleDocumentAction('invoice')}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={true}
            >
              <FaDownload className="-ml-1 mr-3 h-5 w-5 text-white" />
              Скачать счет
            </button>
          </div>
        </div>

        {/* -- Секция документов -- */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Документы по сделке</h2>
          <div className="space-y-4">
            

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">Загрузка счета от поставщика</h3>
              <p className="text-yellow-800 text-sm">Ожидается, что поставщик загрузит счет после оформления договора. Вы будете уведомлены.</p>
            </div>
          </div>
        </div>

      </main>

      {showBankDetailsModal && request?.counterparty && (
        <BankDetailsModal
          isOpen={showBankDetailsModal}
          onClose={() => setShowBankDetailsModal(false)}
          onSave={handleSaveBankDetails}
          initialData={{
            contactPerson: request.counterparty.director || '',
            bankName: request.counterparty.bank_name || '',
            bankBik: request.counterparty.bank_bik || '',
            bankCorrespondentAccount: request.counterparty.bank_corr || '',
            bankSettlementAccount: request.counterparty.bank_account || '',
          }}
        />
      )}
      <Footer />
    </div>
  );
}
