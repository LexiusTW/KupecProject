'use client';

import { useEffect, useState } from 'react';
import {
  ChevronDoubleLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/20/solid';
import type { SearchFormData, Product } from './types'; // 👈 Импорт из твоего types.ts

const API_BASE_URL = 'https://ekbmetal.cloudpub.ru';

interface ResultItem {
  id: number;
  name: string;
  category: string;
  stamp: string | null;
  gost: string | null;
  city: string;
  thickness: string | null;
  length: string | null;
  width: string | null;
  diameter: string | null;
  price: number | null;
  supplier: string;
  material: string | null;
}

interface ResultsTableProps {
  filters: SearchFormData;
  onShowDetails: (product: Product) => void;
}

export default function ResultsTable({
  filters,
  onShowDetails,
}: ResultsTableProps) {
  const [results, setResults] = useState<ResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const limit = 10;

  // Сбрасываем на первую страницу при изменении фильтров
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    setIsLoading(true);
    const fetchResults = async () => {
      const params = new URLSearchParams();

      // Динамически добавляем параметры, только если они не пустые
      if (filters?.supplier) params.append('supplier', filters.supplier);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.grade) params.append('stamp', filters.grade);
      if (filters?.standard) params.append('gost', filters.standard);
      if (filters?.city) params.append('city', filters.city);
      if (filters?.thickness) params.append('thickness', filters.thickness);
      if (filters?.length) params.append('length', filters.length);
      if (filters?.diameter) params.append('diameter', filters.diameter);
      if (filters?.width) params.append('width', filters.width);

      params.append('limit', limit.toString());
      params.append('offset', ((currentPage - 1) * limit).toString());

      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/search?${params}`);
        const data = await res.json();
        setResults(data.items || []);
        setTotal(data.total || 0);
      } catch (error) {
        console.error('Ошибка при получении результатов:', error);
        setResults([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [filters, currentPage]);

  const formatSize = (item: ResultItem): string => {
    const d = item.diameter || '--';
    const t = item.thickness || '--';
    const w = item.width || '--';
    const l = item.length || '--';

    const category = item.category.toLowerCase();

    if (category.includes('труба')) {
      return `⌀${d}x${t}x${l}`;
    }
    if (category.includes('лист')) {
      return `${t}x${w}x${l}`;
    }
    if (category.includes('круг') || category.includes('арматура')) {
      return `⌀${d}x${l}`;
    }
    if (category.includes('уголок') || category.includes('швеллер') || category.includes('двутавр')) {
      return `${w}x${t}x${l}`;
    }

    // A generic fallback that tries to be smart but might not be perfect.
    const parts: string[] = [];
    if (item.diameter) parts.push(`⌀${item.diameter}`);
    if (item.thickness) parts.push(item.thickness);
    if (item.width) parts.push(item.width);
    if (item.length) parts.push(item.length);

    return parts.length > 0 ? parts.join('x') : '—';
  };

  const totalPages = Math.ceil(total / limit);
  const totalColumnCount = 6; // Категория, Марка, ГОСТ, Город, Размер, Цена

  const getPaginationItems = () => {
    const pages = new Set<number>();
    pages.add(1); // всегда показывать первую страницу
    pages.add(totalPages); // всегда показывать последнюю страницу

    // добавить текущую, предыдущую и следующую
    if (currentPage > 1) pages.add(currentPage - 1);
    pages.add(currentPage);
    if (currentPage < totalPages) pages.add(currentPage + 1);

    // добавить еще по одной с каждой стороны для контекста
    if (currentPage > 2) pages.add(currentPage - 2);
    if (currentPage < totalPages - 1) pages.add(currentPage + 2);

    const result: (number | string)[] = [];
    let lastPage: number | null = null;

    // Отфильтровать некорректные страницы (меньше 1 и больше последней)
    const sortedPages = Array.from(pages).sort((a, b) => a - b).filter(p => p > 0 && p <= totalPages);

    for (const page of sortedPages) {
      if (lastPage !== null && page - lastPage > 1) {
        result.push('...');
      }
      result.push(page);
      lastPage = page;
    }
    return result;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
      {isLoading ? (
        <div className="text-center py-6 text-amber-600">Загрузка данных...</div>
      ) : (
        <>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Категория</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Марка</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ГОСТ</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Город</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Размер</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">Цена</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {results.length === 0 ? (
                <tr>
                  <td colSpan={totalColumnCount} className="text-center py-4 text-gray-500">
                    Нет результатов
                  </td>
                </tr>
              ) : (
                results.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      onShowDetails({
                        name: item.name,
                        category: item.category,
                        material: item.material || '', // ✅ Гарантируем строку
                        stamp: item.stamp || '',
                        city: item.city,
                        gost: item.gost || '',
                        diameter: Number(item.diameter) || 0, // ✅ Гарантируем число
                        thickness: Number(item.thickness) || 0, // ✅ Гарантируем число
                        length: Number(item.length) || 0, // ✅ Гарантируем число
                        width: Number(item.width) || 0, // ✅ Гарантируем число
                        supplier: item.supplier,
                        price: item.price || 0, // ✅ Гарантируем число
                      })
                    }
                  >
                    <td className="px-4 py-2">{item.category || '—'}</td>
                    <td className="px-4 py-2">{item.stamp || '—'}</td>
                    <td className="px-4 py-2">{item.gost || '—'}</td>
                    <td className="px-4 py-2">{item.city || '—'}</td>
                    <td className="px-4 py-2">{formatSize(item)}</td>
                    <td className="px-4 py-2 font-semibold">
                      {item.price ? `От ${item.price} ₽` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-xs text-gray-500 mt-2">
                *Цена указана за 1 тонну, с учетом НДС
              </div>
              <nav className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1 || isLoading}
                  className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  aria-label="Первая страница"
                >
                  <ChevronDoubleLeftIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1 || isLoading}
                  className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  aria-label="Предыдущая страница"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>

                {getPaginationItems().map((page, index) =>
                  typeof page === 'number' ? (
                    <button
                      key={index}
                      onClick={() => setCurrentPage(page)}
                      disabled={isLoading}
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        currentPage === page
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  ) : (
                    <span key={index} className="px-4 py-2 text-gray-500">...</span>
                  )
                )}

                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages || isLoading}
                  className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  aria-label="Следующая страница"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages || isLoading}
                  className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  aria-label="Последняя страница"
                >
                  <ChevronDoubleRightIcon className="h-5 w-5" />
                </button>
              </nav>
            </div>
          )}
        </>
      )}
    </div>
  );
}
