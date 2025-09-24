'use client';

import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';

// Assuming these are defined in a shared types file
interface RequestItem {
  id: number;
  kind: string;
  name?: string | null; // Add name property
  category?: string | null;
  // other fields...
}

export interface AnalogueData {
  quantity: string;
  unit: string;
  name: string;
  description: string;
  category: string;
  size: string;
  stamp: string;
  state_standard: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (analogueData: AnalogueData) => void;
  item: RequestItem | null;
  initialData?: Partial<AnalogueData>;
}

const clsInput = 'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500';
const clsButton = 'px-5 py-2 bg-amber-600 text-white rounded-md font-semibold hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500';
const clsButtonSecondary = 'px-4 py-2 border border-gray-300 rounded-md';

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

export default function AnalogModal({ isOpen, onClose, onSave, item, initialData }: Props) {
  const [analogueData, setAnalogueData] = useState<AnalogueData>({
    quantity: '',
    unit: 'шт',
    name: '',
    description: '',
    category: '',
    size: '',
    stamp: '',
    state_standard: '',
  });

  useEffect(() => {
    if (initialData) {
      setAnalogueData(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'size') {
      let formattedValue = value.replace(/ /g, 'x').replace(/x+/g, 'x');
      const parts = formattedValue.split('x');
      if (parts.length > 4) {
        formattedValue = parts.slice(0, 4).join('x');
      }
      setAnalogueData(prev => ({ ...prev, size: formattedValue }));
    } else {
      setAnalogueData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = () => {
    onSave(analogueData);
    onClose();
  };

  const renderMetalFields = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700">Наименование</label>
        <input type="text" name="category" value={analogueData.category} onChange={handleChange} className={`${clsInput} mt-1`} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Размер</label>
        <input type="text" name="size" value={analogueData.size} onChange={handleChange} className={`${clsInput} mt-1`} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">ГОСТ</label>
        <input type="text" name="state_standard" value={analogueData.state_standard} onChange={handleChange} className={`${clsInput} mt-1`} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Марка</label>
        <input type="text" name="stamp" value={analogueData.stamp} onChange={handleChange} className={`${clsInput} mt-1`} />
      </div>
    </>
  );

  const renderGenericFields = () => (
    <>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700">Наименование</label>
        <input type="text" name="name" value={analogueData.name} onChange={handleChange} className={`${clsInput} mt-1`} />
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700">Размеры, характеристики</label>
        <textarea name="description" value={analogueData.description} onChange={handleChange} rows={3} className={`${clsInput} mt-1`}></textarea>
      </div>
    </>
  );

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black bg-opacity-30" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                  Предложить аналог для: {item?.kind === 'metal' ? item.category : item?.name || '—'}
                </Dialog.Title>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {item?.kind === 'metal' ? renderMetalFields() : renderGenericFields()}
                  
                  {/* Common fields */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Количество</label>
                    <input type="number" name="quantity" value={analogueData.quantity} onChange={handleChange} className={`${clsInput} mt-1`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Ед. изм.</label>
                    <select name="unit" value={analogueData.unit} onChange={handleChange} className={`${clsInput} mt-1`}>
                        {units.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-4">
                  <button type="button" onClick={onClose} className={clsButtonSecondary}>Отмена</button>
                  <button type="button" onClick={handleSave} className={clsButton}>Сохранить аналог</button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
