'use client';
import { Product } from './types';

interface ProductModalProps {
  product: Product;
  onClose: () => void;
  onShowGost: (gost: string, product: Product) => void;
}

export default function ProductModal({ product, onClose, onShowGost }: ProductModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {product.name}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Основные характеристики</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Категория:</span>
                    <span className="font-medium">{product.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Материал:</span>
                    <span className="font-medium">{product.material}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Марка:</span>
                    <span className="font-medium">{product.stamp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Город:</span>
                    <span className="font-medium">{product.city}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">ГОСТ</h3>
                <button
                  onClick={() => onShowGost(product.gost, product)}
                  className="text-amber-600 hover:text-amber-800 font-medium cursor-pointer underline"
                >
                  {product.gost}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Размеры</h3>
                <div className="space-y-2">
                  {product.diameter > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Диаметр:</span>
                      <span className="font-medium">{product.diameter} мм</span>
                    </div>
                  )}
                  {product.thickness > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Толщина:</span>
                      <span className="font-medium">{product.thickness} мм</span>
                    </div>
                  )}
                  {product.width > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ширина:</span>
                      <span className="font-medium">{product.width} м</span>
                    </div>
                  )}
                  {product.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Длина:</span>
                      <span className="font-medium">{product.length} м</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Коммерческая информация</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Поставщик:</span>
                    <span className="font-medium">{product.supplier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Цена:</span>
                    <span className="font-medium text-green-600">
                      {product.price ? `От ${product.price.toLocaleString()} ₽` : 'По запросу'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}