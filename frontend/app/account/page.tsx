'use client';

import { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Link from 'next/link';
import SkeletonLoader from '../components/SkeletonLoader';

const API_BASE_URL = 'https://ekbmetal.cloudpub.ru';

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
  quantity: number | null;
  allow_analogs: boolean | null;
  comment: string | null;
};

type RequestItemGeneric = {
  id: number;
  kind: 'generic';
  category: string | null;
  name: string | null;
  note: string | null;
  quantity: number | null;
  comment: string | null;
};

type RequestItem = RequestItemMetal | RequestItemGeneric;

type RequestRow = {
  id: number;
  created_at: string;
  delivery_address: string | null;
  items: RequestItem[];
};

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(`${API_BASE_URL}/api/v1/requests/me`, {
          credentials: 'include',
        });
        if (!r.ok) {
          const er = await r.json().catch(() => ({}));
          throw new Error(er.detail || 'Не удалось загрузить заявки');
        }
        const data = (await r.json()) as RequestRow[];
        setRows(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 flex flex-col">
      <Header />

      <main className="flex-grow">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Личный кабинет</h1>
            <p className="text-gray-600 mt-1">Ваши отправленные заявки</p>
          </div>

          {loading && (
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow p-6">
                  <SkeletonLoader className="h-24 w-full" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="bg-white rounded-xl shadow p-6 text-red-600">{error}</div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="bg-white rounded-xl shadow p-6">
              <p className="text-gray-700">У вас пока нет заявок.</p>
              <Link
                href="/request"
                className="inline-block mt-4 border border-amber-600 text-amber-700 px-4 py-2 rounded-md hover:bg-amber-50"
              >
                Оставить первую заявку
              </Link>
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <div className="space-y-6">
              {rows.map((req) => (
                <div key={req.id} className="bg-white rounded-xl shadow p-6">
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

                    <div className="min-w-[240px]">
                      <div className="text-sm text-gray-500">Адрес доставки</div>
                      <div className="text-gray-800">{req.delivery_address || 'не указан'}</div>
                    </div>
                  </div>

                  <div className="mt-4 border-t pt-4">
                    <div className="text-sm text-gray-500 mb-2">Позиции</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {req.items.map((it) => (
                        <div key={it.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                          {it.kind === 'metal' ? (
                            <>
                              <div><span className="text-gray-500">Категория: </span>{it.category || '—'}</div>
                              <div><span className="text-gray-500">ГОСТ/ТУ: </span>{it.state_standard || '—'}</div>
                              <div><span className="text-gray-500">Марка: </span>{it.stamp || '—'}</div>

                              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
                                <div><span className="text-gray-500">Диаметр: </span>{it.diameter ?? '—'}</div>
                                <div><span className="text-gray-500">Толщина: </span>{it.thickness ?? '—'}</div>
                                <div><span className="text-gray-500">Длина: </span>{it.length ?? '—'}</div>
                                <div><span className="text-gray-500">Ширина: </span>{it.width ?? '—'}</div>
                              </div>

                              <div className="mt-1">
                                <span className="text-gray-500">Количество: </span>{it.quantity ?? '—'}
                              </div>
                              <div className="mt-1">
                                <span className="text-gray-500">Аналоги: </span>{it.allow_analogs ? 'да' : 'нет'}
                              </div>
                              <div className="mt-1">
                                <span className="text-gray-500">Комментарий: </span>{it.comment || '—'}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="md:col-span-2">
                                <span className="text-gray-500">Наименование: </span>
                                {(it as RequestItemGeneric).name || '—'}
                              </div>
                              <div className="mt-1">
                                <span className="text-gray-500">Количество: </span>
                                {(it as RequestItemGeneric).quantity ?? '—'}
                              </div>
                              <div className="mt-1 md:col-span-2">
                                <span className="text-gray-500">Примечание: </span>
                                {(it as RequestItemGeneric).note || '—'}
                              </div>
                              <div className="mt-1 md:col-span-2">
                                <span className="text-gray-500">Комментарий: </span>
                                {(it as RequestItemGeneric).comment || '—'}
                              </div>
                              <div className="mt-1">
                                <span className="text-gray-500">Категория: </span>
                                {(it as RequestItemGeneric).category || '—'}
                              </div>
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
      </main>

      <Footer />
    </div>
  );
}
