'use client';

import { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SkeletonLoader from '../components/SkeletonLoader';

const API_BASE_URL = 'https://kupecbek.cloudpub.ru';

type Email = {
  id: number;
  subject: string;
  content: string;
  sent_at: string;
  is_read: boolean;
  excel_file_path?: string | null;
  // Добавим поля для отправителя/получателя, если они понадобятся в будущем
};

type MailTab = 'inbox' | 'sent';

export default function MailPage() {
  const [activeTab, setActiveTab] = useState<MailTab>('inbox');
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  useEffect(() => {
    const fetchEmails = async () => {
      setIsLoading(true);
      setError(null);
      setSelectedEmail(null); // Сбрасываем выбранное письмо при смене вкладки

      // На бэкенде пока нет разделения ролей, поэтому user_id и role - заглушки
      // В будущем их нужно будет брать из состояния аутентификации
      const role = 'buyer';
      const userId = 1; // ЗАГЛУШКА

      // Временно отключаем загрузку для "Входящих"
      if (activeTab === 'inbox') {
        setEmails([]);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/emails/${activeTab}/${role}/${userId}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || `Не удалось загрузить письма`);
        }
        const data = await response.json();
        setEmails(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e.message);
        setEmails([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmails();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Почта</h1>

        {/* Вкладки */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'inbox'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Входящие
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'sent'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Отправленные
            </button>
          </nav>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Список писем */}
          <div className="md:col-span-1 bg-white rounded-xl shadow p-4 space-y-2 overflow-y-auto max-h-[70vh]">
            {isLoading && [...Array(5)].map((_, i) => <SkeletonLoader key={i} className="h-16 w-full" />)}
            {!isLoading && error && <div className="text-red-600 p-4">{error}</div>}
            {!isLoading && !error && emails.length === 0 && (
              <div className="text-gray-500 p-4 text-center">Папка пуста</div>
            )}
            {!isLoading && !error && emails.map(email => (
              <button
                key={email.id}
                onClick={() => setSelectedEmail(email)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedEmail?.id === email.id ? 'bg-amber-100' : 'hover:bg-gray-50'
                } ${!email.is_read && activeTab === 'inbox' ? 'font-bold' : ''}`}
              >
                <div className="text-sm text-gray-800 truncate">{email.subject}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(email.sent_at).toLocaleString('ru-RU')}
                </div>
              </button>
            ))}
          </div>

          {/* Просмотр письма */}
          <div className="md:col-span-2 bg-white rounded-xl shadow p-6">
            {selectedEmail ? (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">{selectedEmail.subject}</h2>
                <div className="text-sm text-gray-500 mb-4 border-b pb-4">
                  Дата: {new Date(selectedEmail.sent_at).toLocaleString('ru-RU')}
                </div>
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.content }}
                />
                {selectedEmail.excel_file_path && (
                  <div className="mt-6 pt-4 border-t">
                    <a
                      href={`${API_BASE_URL}/api/v1/excel/download/${selectedEmail.excel_file_path}`}
                      download
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.' +
  '75 0 00-1.09-1.03l-2.955 3.129V2.75z" /><path d="M3.5 12.75a.75.' +
  '75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" /></svg>
                      Скачать Excel
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Выберите письмо для просмотра
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}