'use client';

import { useEffect, useRef, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { Listbox } from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/20/solid';

const API_BASE_URL = 'https://ekbmetal.cloudpub.ru';

const clsInput = 'w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500';
const clsLabel = 'block text-sm font-medium text-gray-700 mb-1';
const clsCard  = 'bg-white rounded-xl shadow p-5';

function SelectField({
  label, value, onChange, options, placeholder = 'Выбрать',
}: { label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <div>
      <label className={clsLabel}>{label}</label>
      <Listbox value={value || ''} onChange={onChange}>
        <div className="relative">
          <Listbox.Button className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-4 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
            <span className="block truncate">{value || placeholder}</span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </span>
          </Listbox.Button>
          <Listbox.Options className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {options.map((opt, i) => (
              <Listbox.Option
                key={`${opt}-${i}`}
                value={opt}
                className={({ active }) =>
                  `relative cursor-default select-none py-2 pl-10 pr-4 ${
                    active ? 'bg-amber-100 text-amber-900' : 'text-gray-900'
                  }`
                }
              >
                {opt}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </div>
      </Listbox>
    </div>
  );
}

type MetalItemForm = {
  mCategory: string;
  gost: string;
  grade: string;
  diameter: string;
  thickness: string;
  length: string;
  width: string;
  quantity: string;
  allowAnalogs: boolean;
  comment: string;
};

type MetalItemSaved = {
  kind: 'metal';
  category?: string;
  state_standard?: string | null;
  stamp?: string | null;
  diameter?: number | null;
  thickness?: number | null;
  length?: number | null;
  width?: number | null;
  quantity?: number | null;
  allow_analogs?: boolean;
  comment?: string | null;
  _editing?: boolean;
};

type GenericItemForm = {
  name: string;
  note: string;
  quantity: string;
  comment: string;
};
type GenericItemSaved = {
  kind: 'generic';
  name?: string;
  note?: string;
  quantity?: number | null;
  comment?: string | null;
  _editing?: boolean;
};

type CategoryGroup = {
  id: string;
  title: string;
  editingTitle?: boolean;
  items: Array<MetalItemSaved | GenericItemSaved>;
};

type OptionsPack = {
  categories: string[];
  grades: string[];
  standards: string[];
};

function MetalEditor({
  initial, initialOptions, onSave, onCancel,
}: {
  initial?: MetalItemSaved;
  initialOptions: OptionsPack;
  onSave: (it: MetalItemSaved) => void;
  onCancel: () => void;
}) {
  const { control, register, handleSubmit, setValue } = useForm<MetalItemForm>({
    defaultValues: {
      mCategory: initial?.category || '',
      gost: initial?.state_standard || '',
      grade: initial?.stamp || '',
      diameter: initial?.diameter?.toString() || '',
      thickness: initial?.thickness?.toString() || '',
      length: initial?.length?.toString() || '',
      width: initial?.width?.toString() || '',
      quantity: initial?.quantity?.toString() || '',
      allowAnalogs: !!initial?.allow_analogs,
      comment: initial?.comment || '',
    },
  });

  const [cats]   = useState<string[]>(initialOptions.categories);
  const [gosts, setGosts]   = useState<string[]>(initialOptions.standards);
  const [grades, setGrades] = useState<string[]>(initialOptions.grades);

  const gostsCache  = useRef(new Map<string, string[]>());
  const gradesCache = useRef(new Map<string, string[]>());

  const { mCategory, gost, grade } = useWatch({ control }) as MetalItemForm;

  useEffect(() => {
    if (!mCategory) { setGosts(initialOptions.standards); return; }
    const key = `${mCategory}|${grade||''}`;
    const cached = gostsCache.current.get(key);
    if (cached) { setGosts(cached); return; }

    const params = new URLSearchParams();
    params.append('category', mCategory);
    if (grade) params.append('stamp', grade);

    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/v1/gosts?${params}`, { credentials: 'include' });
        if (r.ok) {
          const data: string[] = await r.json();
          gostsCache.current.set(key, data);
          setGosts(data);
        }
      } catch {}
    })();
  }, [mCategory, grade]);

  useEffect(() => {
    if (!mCategory) { setGrades(initialOptions.grades); return; }
    const key = `${mCategory}|${gost||''}`;
    const cached = gradesCache.current.get(key);
    if (cached) { setGrades(cached); return; }

    const params = new URLSearchParams();
    params.append('category', mCategory);
    if (gost) params.append('gost', gost);

    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/v1/stamps?${params}`, { credentials: 'include' });
        if (r.ok) {
          const data: string[] = await r.json();
          gradesCache.current.set(key, data);
          setGrades(data);
        }
      } catch {}
    })();
  }, [mCategory, gost]);

  useEffect(() => {
    setValue('gost', '');
    setValue('grade', '');
  }, [mCategory]);

  const renderSelect = (name: keyof MetalItemForm, label: string, opts: string[]) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <SelectField
          label={label}
          value={field.value}
          onChange={(v) => field.onChange(v)}
          options={opts}
        />
      )}
    />
  );

  const onSubmit = (data: MetalItemForm) => {
    onSave({
      kind: 'metal',
      category: data.mCategory || undefined,
      state_standard: data.gost || null,
      stamp: data.grade || null,
      diameter: data.diameter ? Number(data.diameter) : null,
      thickness: data.thickness ? Number(data.thickness) : null,
      length: data.length ? Number(data.length) : null,
      width: data.width ? Number(data.width) : null,
      quantity: data.quantity ? Number(data.quantity) : null,
      allow_analogs: !!data.allowAnalogs,
      comment: data.comment || null,
      _editing: false,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {renderSelect('mCategory', 'Наименование', cats)}
        {renderSelect('gost', 'ГОСТ / ТУ', gosts)}
        {renderSelect('grade', 'Марка', grades)}

        <div>
          <label className={clsLabel}>Количество</label>
          <input type="number" step="any" min="0" {...register('quantity')} className={clsInput} />
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('allowAnalogs')} className="h-4 w-4" />
            <span className="text-sm text-gray-700">Аналоги</span>
          </label>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className={clsLabel}>Диаметр (мм)</label>
          <input type="number" step="any" min="0" {...register('diameter')} className={clsInput} />
        </div>
        <div>
          <label className={clsLabel}>Толщина (мм)</label>
          <input type="number" step="any" min="0" {...register('thickness')} className={clsInput} />
        </div>
        <div>
          <label className={clsLabel}>Длина (м)</label>
          <input type="number" step="any" min="0" {...register('length')} className={clsInput} />
        </div>
        <div>
          <label className={clsLabel}>Ширина (м)</label>
          <input type="number" step="any" min="0" {...register('width')} className={clsInput} />
        </div>
        <div>
          <label className={clsLabel}>Комментарий</label>
          <input {...register('comment')} className={clsInput} placeholder="Комментарий к металлу" />
        </div>
      </div>

      <div className="pt-1 flex gap-3">
        <button type="submit" className="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700">
          Сохранить
        </button>
        <button type="button" onClick={onCancel} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50">
          Отменить
        </button>
      </div>
    </form>
  );
}

function GenericEditor({
  initial, onSave, onCancel,
}: {
  initial?: GenericItemSaved;
  onSave: (it: GenericItemSaved) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit } = useForm<GenericItemForm>({
    defaultValues: {
      name: initial?.name || '',
      note: initial?.note || '',
      quantity: initial?.quantity?.toString() || '',
      comment: initial?.comment || '',
    },
  });

  const onSubmit = (d: GenericItemForm) => {
    onSave({
      kind: 'generic',
      name: d.name || '',
      note: d.note || '',
      quantity: d.quantity ? Number(d.quantity) : null,
      comment: d.comment || '',
      _editing: false,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className={clsLabel}>Наименование</label>
          <input className={clsInput} {...register('name', { required: true })} placeholder="Например: Доска строганая 50×150" />
        </div>
        <div>
          <label className={clsLabel}>Количество</label>
          <input type="number" step="any" min="0" className={clsInput} {...register('quantity')} placeholder="Количество" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={clsLabel}>Примечание</label>
          <input className={clsInput} {...register('note')} placeholder="Цвет, сорт, комплектация…" />
        </div>
        <div>
          <label className={clsLabel}>Комментарий</label>
          <input className={clsInput} {...register('comment')} placeholder="Комментарий к товару" />
        </div>
      </div>

      <div className="pt-1 flex gap-3">
        <button type="submit" className="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700">
          Сохранить
        </button>
        <button type="button" onClick={onCancel} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50">
          Отменить
        </button>
      </div>
    </form>
  );
}


type RequestItemPayload =
  | ({
      // металл
      kind: 'metal';
      category?: string;
      state_standard?: string | null;
      stamp?: string | null;
      diameter?: number | null;
      thickness?: number | null;
      length?: number | null;
      width?: number | null;
      quantity?: number | null;
      allow_analogs?: boolean;
      comment?: string | null;
    })
  | ({
      // прочие категории
      kind: 'generic';
      category?: string; // сюда положим НАЗВАНИЕ пользовательской категории
      name?: string;
      note?: string;
      quantity?: number | null;
      comment?: string | null;
    });

export default function RequestPage() {
  // адрес доставки
  const [address, setAddress] = useState('');
  const [addressEdit, setAddressEdit] = useState(true);
  const [addressLoading, setAddressLoading] = useState(false);

  // группы категорий
  const [groups, setGroups] = useState<CategoryGroup[]>([
    { id: crypto.randomUUID(), title: '', editingTitle: true, items: [] },
  ]);

  // справочники для «Металл» (подгружаем на входе)
  const [initialOptions, setInitialOptions] = useState<OptionsPack>({
    categories: [], grades: [], standards: [],
  });

  // загрузка адреса и опций
  useEffect(() => {
    (async () => {
      try {
        setAddressLoading(true);
        const r = await fetch(`${API_BASE_URL}/api/v1/users/me/address`, { credentials: 'include' });
        if (r.ok) {
          const data = await r.json();
          if (data?.delivery_address) {
            setAddress(data.delivery_address);
            setAddressEdit(false);
          }
        }
      } finally {
        setAddressLoading(false);
      }
    })();

    (async () => {
      try {
        const [cat, stp, gst] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/categories`, { credentials: 'include' }),
          fetch(`${API_BASE_URL}/api/v1/stamps`,     { credentials: 'include' }),
          fetch(`${API_BASE_URL}/api/v1/gosts`,      { credentials: 'include' }),
        ]);
        setInitialOptions({
          categories: await cat.json(),
          grades: await stp.json(),
          standards: await gst.json(),
        });
      } catch {
      }
    })();
  }, []);

  const saveAddress = async () => {
    try {
      setAddressLoading(true);
      const r = await fetch(`${API_BASE_URL}/api/v1/users/me/address`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ delivery_address: address }),
      });
      if (!r.ok) throw new Error('Не удалось сохранить адрес');
      setAddressEdit(false);
    } catch (e: any) {
      alert(e.message || 'Ошибка сохранения адреса');
    } finally {
      setAddressLoading(false);
    }
  };

  const addGroup = () =>
    setGroups((g) => [...g, { id: crypto.randomUUID(), title: '', editingTitle: true, items: [] }]);

  const saveGroupTitle = (id: string, title: string) =>
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, title, editingTitle: false } : g)));

  const editGroupTitle = (id: string) =>
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, editingTitle: true } : g)));

  const removeGroup = (id: string) =>
    setGroups((gs) => gs.filter((g) => g.id !== id));

  const addItemToGroup = (gid: string, kind: 'metal' | 'generic') =>
    setGroups((gs) =>
      gs.map((g) =>
        g.id === gid
          ? {
              ...g,
              items: [
                ...g.items,
                kind === 'metal'
                  ? ({ kind: 'metal', _editing: true } as MetalItemSaved)
                  : ({ kind: 'generic', _editing: true } as GenericItemSaved),
              ],
            }
          : g
      )
    );

  const saveItemInGroup = (gid: string, idx: number, payload: MetalItemSaved | GenericItemSaved) =>
    setGroups((gs) =>
      gs.map((g) =>
        g.id === gid
          ? { ...g, items: g.items.map((it, i) => (i === idx ? payload : it)) }
          : g
      )
    );

  const editItemInGroup = (gid: string, idx: number) =>
    setGroups((gs) =>
      gs.map((g) =>
        g.id === gid
          ? { ...g, items: g.items.map((it, i) => (i === idx ? { ...it, _editing: true } : it)) }
          : g
      )
    );

  const removeItemInGroup = (gid: string, idx: number) =>
    setGroups((gs) =>
      gs.map((g) =>
        g.id === gid
          ? { ...g, items: g.items.filter((_, i) => i !== idx) }
          : g
      )
    );

  const submitAll = async () => {
    // соберём все сохранённые товары из всех групп
    const toSend: RequestItemPayload[] = [];
    for (const g of groups) {
      for (const it of g.items) {
        if (it._editing) continue;
        if (it.kind === 'metal') {
          toSend.push({
            kind: 'metal',
            category: it.category,
            state_standard: it.state_standard ?? null,
            stamp: it.stamp ?? null,
            diameter: it.diameter ?? null,
            thickness: it.thickness ?? null,
            length: it.length ?? null,
            width: it.width ?? null,
            quantity: it.quantity ?? null,
            allow_analogs: it.allow_analogs ?? false,
            comment: it.comment ?? null,
          });
        } else {
          toSend.push({
            kind: 'generic',
            category: g.title || 'Прочее',
            name: (it as GenericItemSaved).name || '',
            note: (it as GenericItemSaved).note || '',
            quantity: (it as GenericItemSaved).quantity ?? null,
            comment: (it as GenericItemSaved).comment || '',
          });
        }
      }
    }

    if (!toSend.length) {
      alert('Добавьте и сохраните хотя бы один товар в любой категории');
      return;
    }

    try {
      const r = await fetch(`${API_BASE_URL}/api/v1/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items: toSend }),
      });
      if (!r.ok) {
        const er = await r.json().catch(() => ({}));
        throw new Error(er.detail || 'Не удалось сохранить заявку');
      }
      alert('Заявка сохранена');
      setGroups([{ id: crypto.randomUUID(), title: '', editingTitle: true, items: [] }]);
    } catch (e: any) {
      alert(e.message || 'Ошибка отправки заявки');
    }
  };

  const resetAll = () => {
    setGroups([{ id: crypto.randomUUID(), title: '', editingTitle: true, items: [] }]);
  };

  const isMetal = (title: string) => title.trim().toLowerCase() === 'металл';

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 flex flex-col">
      <Header />

      <main className="flex-grow">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Новая заявка</h1>
            <p className="text-gray-600 mt-1">Создайте категории и добавьте товары</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {groups.map((g, gi) => (
                <div key={g.id} className={clsCard}>
                  <div className="flex items-center justify-between">
                    {g.editingTitle ? (
                      <div className="flex-1">
                        <label className={clsLabel}>Название категории</label>
                        <div className="flex gap-3">
                          <input
                            className={clsInput}
                            placeholder='Например: "Металл", "Дерево", "Кроссовки"'
                            value={g.title}
                            onChange={(e) =>
                              setGroups((gs) =>
                                gs.map((x) => (x.id === g.id ? { ...x, title: e.target.value } : x))
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() => saveGroupTitle(g.id, g.title.trim())}
                            disabled={!g.title.trim()}
                            className="bg-amber-600 text-white px-4 rounded-md hover:bg-amber-700 disabled:opacity-50"
                          >
                            Сохранить
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-xl font-semibold">
                          Категория: <span className="text-gray-800">{g.title || '—'}</span>
                        </h2>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => editGroupTitle(g.id)}
                            className="text-amber-700 hover:underline"
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            onClick={() => removeGroup(g.id)}
                            className="text-red-600 hover:underline"
                          >
                            Удалить
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {!g.editingTitle && (
                    <div className="mt-5 space-y-5">
                      {g.items.map((it, idx) => (
                        <div key={idx} className="rounded-lg border border-gray-200 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-sm text-gray-500">Товар #{idx + 1}</div>
                            {!it._editing && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => editItemInGroup(g.id, idx)}
                                  className="text-amber-700 hover:underline"
                                >
                                  Изменить
                                </button>
                                <button
                                  onClick={() => removeItemInGroup(g.id, idx)}
                                  className="text-red-600 hover:underline"
                                >
                                  Удалить
                                </button>
                              </div>
                            )}
                          </div>

                          {it._editing ? (
                            isMetal(g.title) ? (
                              <MetalEditor
                                initial={it.kind === 'metal' ? it : undefined}
                                initialOptions={initialOptions}
                                onSave={(payload) => saveItemInGroup(g.id, idx, payload)}
                                onCancel={() => removeItemInGroup(g.id, idx)}
                              />
                            ) : (
                              <GenericEditor
                                initial={it.kind === 'generic' ? it : undefined}
                                onSave={(payload) => saveItemInGroup(g.id, idx, payload)}
                                onCancel={() => removeItemInGroup(g.id, idx)}
                              />
                            )
                          ) : (
                            <>
                              {it.kind === 'metal' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-gray-800">
                                  <div><span className="text-gray-500">Категория: </span>{it.category || '—'}</div>
                                  <div><span className="text-gray-500">ГОСТ/ТУ: </span>{it.state_standard || '—'}</div>
                                  <div><span className="text-gray-500">Марка: </span>{it.stamp || '—'}</div>
                                  <div><span className="text-gray-500">Диаметр: </span>{it.diameter ?? '—'}</div>
                                  <div><span className="text-gray-500">Толщина: </span>{it.thickness ?? '—'}</div>
                                  <div><span className="text-gray-500">Длина: </span>{it.length ?? '—'}</div>
                                  <div><span className="text-gray-500">Ширина: </span>{it.width ?? '—'}</div>
                                  <div><span className="text-gray-500">Количество: </span>{it.quantity ?? '—'}</div>
                                  <div><span className="text-gray-500">Аналоги: </span>{it.allow_analogs ? 'да' : 'нет'}</div>
                                  <div className="md:col-span-2 lg:col-span-3">
                                    <span className="text-gray-500">Комментарий: </span>{it.comment || '—'}
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-gray-800">
                                  <div className="md:col-span-2"><span className="text-gray-500">Наименование: </span>{(it as GenericItemSaved).name || '—'}</div>
                                  <div><span className="text-gray-500">Количество: </span>{(it as GenericItemSaved).quantity ?? '—'}</div>
                                  <div className="md:col-span-2"><span className="text-gray-500">Примечание: </span>{(it as GenericItemSaved).note || '—'}</div>
                                  <div className="md:col-span-3"><span className="text-gray-500">Комментарий: </span>{(it as GenericItemSaved).comment || '—'}</div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => addItemToGroup(g.id, isMetal(g.title) ? 'metal' : 'generic')}
                          className="border border-amber-600 text-amber-700 px-4 py-2 rounded-md hover:bg-amber-50"
                        >
                          Добавить товар
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addGroup}
                className="border border-dashed border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
              >
                + Добавить категорию
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={submitAll}
                  className="bg-amber-600 text-white px-6 py-2 rounded-md hover:bg-amber-700"
                >
                  Сохранить заявку
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="border border-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-50"
                >
                  Сбросить всё
                </button>
              </div>
            </div>

            {/* Правая колонка — адрес доставки */}
            <aside className="space-y-4">
              <div className={clsCard}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-medium">Адрес доставки</h2>
                  {!addressEdit && (
                    <button onClick={() => setAddressEdit(true)} className="text-amber-700 hover:underline">
                      Изменить
                    </button>
                  )}
                </div>

                {addressEdit ? (
                  <>
                    <input
                      className={clsInput}
                      placeholder="Например: г. Екатеринбург, ул. …, склад №…"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={saveAddress}
                      disabled={addressLoading || !address}
                      className="mt-3 bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 disabled:opacity-50"
                    >
                      {addressLoading ? 'Сохраняем…' : 'Сохранить адрес'}
                    </button>
                  </>
                ) : (
                  <p className="text-gray-800">{address || 'Адрес не указан'}</p>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
