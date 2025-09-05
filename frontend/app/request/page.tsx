'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const API_BASE_URL = 'https://ekbmetal.cloudpub.ru';

// ---------------- Types ----------------
type RowKind = 'metal' | 'generic';

type MetalRow = {
  _id: string;
  kind: 'metal';
  mCategory?: string; // Категория (лист/труба…)
  size?: string;      // "1x1x1"
  gost?: string;
  grade?: string;
  allowAnalogs?: boolean;
  qty?: string;
  comment?: string;
};

type GenericRow = {
  _id: string;
  kind: 'generic';
  name?: string;
  dims?: string;  // размеры/характеристики
  uom?: string;   // ед. изм.
  qty?: string;
  comment?: string;
};

type Row = MetalRow | GenericRow;

type OptionsPack = {
  categories: string[];
  grades: string[];
  standards: string[];
};

type SavedMetalItem = {
  kind: 'metal';
  category?: string | null;
  size?: string | null;           // показываем в таблице
  state_standard?: string | null;
  stamp?: string | null;
  quantity: number | null;
  allow_analogs: boolean;
  comment?: string | null;
};

type SavedGenericItem = {
  kind: 'generic';
  category: string; // пользовательская категория
  name: string;
  dims?: string | null; // размеры/характеристики
  uom?: string | null;  // ед. изм.
  quantity: number | null;
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

type DaDataAddr = { value: string; unrestricted_value?: string };

const clsInput =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500';
const clsBtn = 'px-4 py-2 rounded-md';
const th = 'px-3 py-2 text-left text-xs font-semibold text-gray-600';
const td = 'px-3 py-2';

export default function RequestPage() {
  // ---------------- Header fields ----------------
  const [title, setTitle] = useState('');
  const [deliveryAt, setDeliveryAt] = useState('');
  const [address, setAddress] = useState('');

  // флаги сохранения адреса
  const [addressSaved, setAddressSaved] = useState(true);
  const [addressDirty, setAddressDirty] = useState(false);
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

  // ------- Init: address from profile & options -------
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/v1/users/me/address`, { credentials: 'include' });
        if (r.ok) {
          const data = await r.json();
          if (data?.delivery_address !== undefined) {
            setAddress(data.delivery_address || '');
            setAddressSaved(true);
            setAddressDirty(false);
          }
        }
      } catch { /* noop */ }
    })();

    (async () => {
      try {
        const [cat, stp, gst] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/categories`, { credentials: 'include' }),
          fetch(`${API_BASE_URL}/api/v1/stamps`, { credentials: 'include' }),
          fetch(`${API_BASE_URL}/api/v1/gosts`, { credentials: 'include' }),
        ]);
        setOpts({
          categories: (await cat.json()) ?? [],
          grades: (await stp.json()) ?? [],
          standards: (await gst.json()) ?? [],
        });
      } catch { /* noop */ }
    })();
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
      const list: DaDataAddr[] = (data?.suggestions ?? []).map((s:any)=>({ value: s.value, unrestricted_value: s.unrestricted_value }));
      addrCache.current.set(q, list);
      return list;
    } catch {
      return [] as DaDataAddr[];
    } finally {
      setAddrLoading(false);
    }
  };

  // ------- Address suggestions via backend (debounce 100ms + cancel + cache + prefetch on focus) -------
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

  // ------- Auto-save address on selection / explicit save / blur if changed -------
  const persistAddress = async (value: string) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/v1/users/me/address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ delivery_address: value }),
      });
      if (r.ok) {
        setAddressSaved(true);
        setAddressDirty(false);
      }
    } catch { /* ignore */ }
  };

  const onPickAddress = (val: string) => {
    setAddress(val);
    setAddrQuery('');
    setAddrSugg([]);
    setAddressSaved(false);
    setAddressDirty(true);
    // моментально сохраняем выбранный вариант
    persistAddress(val);
  };

  const onBlurAddress = () => {
    setAddrFocus(false);
    if (addressDirty && address && !addrSugg.length) {
      persistAddress(address);
    }
  };

  const onSaveAddressClick = async () => {
    await persistAddress(address);
  };

  const clearAddress = async () => {
    setAddress('');
    setAddrQuery('');
    setAddrSugg([]);
    setAddressSaved(false);
    setAddressDirty(true);
    await persistAddress('');
  };

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
        if (!m.mCategory || !m.qty) { alert('Для металлопроката укажите Категорию и Количество'); return c; }
        item = {
          kind: 'metal',
          category: m.mCategory || null,
          size: m.size || null,
          state_standard: m.gost || null,
          stamp: m.grade || null,
          quantity: m.qty ? Number(m.qty) : null,
          allow_analogs: !!m.allowAnalogs,
          comment: m.comment || null,
        };
      } else {
        const g = row as GenericRow;
        if (!g.name || !g.qty) { alert('Для прочей позиции укажите Наименование и Количество'); return c; }
        item = {
          kind: 'generic',
          category: c.title?.trim() || 'Прочее', // пользовательская категория
          name: g.name || '',
          dims: g.dims || null,
          uom: g.uom || null,
          quantity: g.qty ? Number(g.qty) : null,
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

  const saveRequest = async () => {
    if (!allSavedItems.length) { alert('Добавьте и сохраните хотя бы одну позицию'); return; }
    try {
      const r = await fetch(`${API_BASE_URL}/api/v1/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: allSavedItems,
          comment: title?.trim() || undefined,
          delivery_at: deliveryAt || null,
          delivery_address: address || null,
        }),
      });
      if (!r.ok) throw new Error('Не удалось сохранить заявку');
      alert('Заявка сохранена');
      setCats([]);
    } catch (e:any) {
      alert(e.message || 'Ошибка сохранения');
    }
  };
  const sendRequest = async () => { await saveRequest(); };

  // ---------------- Render ----------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 flex flex-col">
      <Header />

      <main className="flex-grow">
        <div className="container mx-auto px-4 py-8 space-y-6">

          {/* ---- Шапка заявки ---- */}
          <div className="bg-white rounded-xl shadow p-5">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название заявки</label>
                <input className={clsInput} value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Например: Поставка на объект А" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата и время поставки</label>
                <input type="datetime-local" className={clsInput} value={deliveryAt} onChange={(e)=>setDeliveryAt(e.target.value)} />
              </div>

              {/* Адрес с подсказками (выпадает ТОЛЬКО при фокусе) */}
              <div className="lg:col-span-2 relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Адрес поставки</label>
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input
                      className={clsInput + ' w-full'}
                      value={address}
                      onFocus={()=>{ setAddrFocus(true); setAddrQuery(address); }}
                      onBlur={onBlurAddress}
                      onChange={(e)=>{ setAddress(e.target.value); setAddrQuery(e.target.value); setAddressSaved(false); setAddressDirty(true); }}
                      placeholder="Начните вводить адрес..."
                    />
                    {addrFocus && addrSugg.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow">
                        {addrSugg.map((s, i) => (
                          <button
                            type="button"
                            key={i}
                            onMouseDown={()=> onPickAddress(s.unrestricted_value || s.value)}
                            className="block w-full text-left px-3 py-2 hover:bg-amber-50"
                          >
                            {s.unrestricted_value || s.value}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Кнопка: если адрес редактировался — Сохранить, иначе (и адрес есть) — Очистить */}
                  {addressDirty ? (
                    <button type="button" onClick={onSaveAddressClick} className="px-3 py-2 bg-amber-600 text-white rounded-md">
                      Сохранить
                    </button>
                  ) : (
                    address ? (
                      <button type="button" onClick={clearAddress} className="px-3 py-2 border border-gray-300 rounded-md">
                        Очистить
                      </button>
                    ) : null
                  )}

                  {/* Спиннер загрузки подсказок */}
                  {addrLoading && (
                    <div className="text-xs text-gray-500">Загрузка…</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={saveRequest} className={`bg-amber-600 text-white ${clsBtn}`}>Сохранить</button>
              <button type="button" onClick={sendRequest} className={`border border-amber-600 text-amber-700 ${clsBtn}`}>Разослать</button>
            </div>
          </div>

          {/* ---- Категории и позиции ---- */}
          {cats.map(cat => (
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
                                  <td className={td}>{g.uom || '—'}</td>
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
                        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                          <div>
                            <div className="text-xs text-gray-600 mb-1">Категория (лист, труба)</div>
                            <select className={clsInput}
                              value={(row as MetalRow).mCategory || ''}
                              onChange={(e)=>setCell(cat.id, row._id, 'mCategory', e.target.value)}
                            >
                              <option value="">—</option>
                              {opts.categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">Размер (1×1×1)</div>
                            <input className={clsInput} placeholder="1x1x1"
                              value={(row as MetalRow).size || ''}
                              onChange={(e)=>setCell(cat.id, row._id, 'size', e.target.value)} />
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">ГОСТ</div>
                            <select className={clsInput}
                              value={(row as MetalRow).gost || ''}
                              onChange={(e)=>setCell(cat.id, row._id, 'gost', e.target.value)}
                            >
                              <option value="">—</option>
                              {opts.standards.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">Марка</div>
                            <select className={clsInput}
                              value={(row as MetalRow).grade || ''}
                              onChange={(e)=>setCell(cat.id, row._id, 'grade', e.target.value)}
                            >
                              <option value="">—</option>
                              {opts.grades.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">Аналоги</div>
                            <select className={clsInput}
                              value={(row as MetalRow).allowAnalogs ? 'Да' : 'Нет'}
                              onChange={(e)=>setCell(cat.id, row._id,'allowAnalogs', e.target.value === 'Да')}
                            >
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
                            <div className="text-xs text-gray-600 mb-1">Комментарий</div>
                            <input className={clsInput}
                              value={(row as MetalRow).comment || ''}
                              onChange={(e)=>setCell(cat.id, row._id, 'comment', e.target.value)} />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
                            <div className="text-xs text-gray-600 mb-1">Ед. изм.</div>
                            <input className={clsInput}
                              value={(row as GenericRow).uom || ''}
                              onChange={(e)=>setCell(cat.id, row._id, 'uom', e.target.value)} />
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">Количество</div>
                            <input className={clsInput} type="number" min="0" step="any"
                              value={(row as GenericRow).qty || ''}
                              onChange={(e)=>setCell(cat.id, row._id, 'qty', e.target.value)} />
                          </div>
                          <div className="md:col-span-5">
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
          ))}

          {/* Кнопка добавить категорию — слева */}
          <div className="flex justify-start">
            <button
              type="button"
              onClick={addCategory}
              className="px-5 py-3 border border-dashed border-gray-400 rounded-md text-gray-700 bg-white shadow-sm"
            >
              + Добавить категорию
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
