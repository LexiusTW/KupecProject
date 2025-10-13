'use client';

import { useForm, Controller, useWatch } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { Listbox } from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/20/solid';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export type SearchFormData = {
  supplier: string;
  category: string;
  grade: string;
  standard: string;
  city: string;
  thickness: string;
  length: string;
  width: string;
  diameter: string;
};

export default function SearchForm({
  onSearch,
}: {
  onSearch: (data: SearchFormData) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: {},
    reset,
  } = useForm<SearchFormData>({
    defaultValues: {
      supplier: '',
      category: '',
      grade: '',
      standard: '',
      city: '',
      thickness: '',
      length: '',
      width: '',
      diameter: '',
    },
  });

  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [standards, setStandards] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  const watchedFields = useWatch({ control });
  const watchedFieldsJSON = JSON.stringify(watchedFields);

  useEffect(() => {
    const buildQuery = (exclude?: keyof SearchFormData) => {
      const params = new URLSearchParams();
      const mapping: { [key in keyof Omit<SearchFormData, 'thickness' | 'length' | 'width'>]?: string } = {
        supplier: 'supplier',
        category: 'category',
        grade: 'stamp',
        standard: 'gost',
        city: 'city',
      };

      for (const key in mapping) {
        const formKey = key as keyof typeof mapping;
        const value = watchedFields[formKey];
        if (formKey !== exclude && value) {
          params.append(mapping[formKey]!, value);
        }
      }
      return params.toString();
    };

    const fetchData = async () => {
      try {
        const [supRes, catRes, stampRes, gostRes, cityRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/suppliers?${buildQuery('supplier')}`),
          fetch(`${API_BASE_URL}/api/v1/categories?${buildQuery('category')}`),
          fetch(`${API_BASE_URL}/api/v1/stamps?${buildQuery('grade')}`),
          fetch(`${API_BASE_URL}/api/v1/gosts?${buildQuery('standard')}`),
          fetch(`${API_BASE_URL}/api/v1/cities?${buildQuery('city')}`),
        ]);

        setSuppliers(await supRes.json());
        setCategories(await catRes.json());
        setGrades(await stampRes.json());
        setStandards(await gostRes.json());
        setCities(await cityRes.json());
      } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedFieldsJSON]);

  const onSubmit = (data: SearchFormData) => {
    onSearch(data);
  };

  const renderField = (
    name: keyof SearchFormData,
    label: string,
    options: string[]
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Listbox value={field.value || ''} onChange={field.onChange}>
            <div className="relative">
              <Listbox.Button className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-4 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                <span className="block truncate">
                  {field.value
                    ? field.value
                    : `Выбрать`}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon
                    className="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </span>
              </Listbox.Button>
              <Listbox.Options className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                {options.map((option, index) => (
                  <Listbox.Option
                    key={index}
                    value={option}
                    className={({ active }) => `relative cursor-default select-none py-2 pl-10 pr-4 ${
                        active ? 'bg-amber-100 text-amber-900' : 'text-gray-900'
                      }` }
                  >
                    {option}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>
        )}
      />
    </div>
  );

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white p-6 rounded-lg shadow-md space-y-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {renderField('supplier', 'Поставщик', suppliers)}
        {renderField('category', 'Категория', categories)}
        {renderField('grade', 'Марка', grades)}
        {renderField('standard', 'ГОСТ / ТУ', standards)}
        {renderField('city', 'Город', cities)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Диаметр {"(мм)"}</label>
          <input
            type="number"
            step="any"
            min="0"
            {...register('diameter')}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Введите диаметр"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Толщина {"(мм)"}</label>
          <input
            type="number"
            step="any"
            min="0"
            {...register('thickness')}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Введите толщину"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Длина {"(м)"}</label>
          <input
            type="number"
            step="any"
            min="0"
            {...register('length')}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Введите длину"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ширина {"(м)"}</label>
          <input
            type="number"
            step="any"
            min="0"
            {...register('width')}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Введите ширину"
          />
        </div>
      </div>
      <div className="pt-4 flex justify-center gap-4">
        <button
          type="submit"
          className="bg-amber-600 text-white px-6 py-2 rounded-md hover:bg-amber-700 transition-colors"
        >
          Найти
        </button>
        <button
          type="button"
          onClick={() => reset()}
          className="bg-gray-300 text-gray-800 px-6 py-2 rounded-md hover:bg-gray-400 transition-colors"
        >
          Сбросить
        </button>
      </div>
    </form>
  );
}
