'use client';

import Link from 'next/link';

type GostModalProps = {
  gost: string;
  product: {
    name: string;
    supplier: string;
  };
  onClose: () => void;
};

export default function GostModal({ gost, product, onClose }: GostModalProps) {
  const gostInfo: Record<string, {
    name: string;
    description: string;
    scope: string;
    year: string;
    status: string;
  }> = {
    'ГОСТ 8239-89': {
      name: 'Двутавры стальные горячекатаные',
      description: 'Настоящий стандарт распространяется на стальные горячекатаные двутавры, предназначенные для строительных металлических конструкций.',
      scope: 'Строительные металлоконструкции',
      year: '1989',
      status: 'Действующий',
    },
    'ГОСТ 8240-97': {
      name: 'Швеллеры стальные горячекатаные',
      description: 'Настоящий стандарт распространяется на стальные горячекатаные швеллеры, применяемые в строительных металлических конструкциях.',
      scope: 'Строительные конструкции',
      year: '1997',
      status: 'Действующий',
    },
    'ГОСТ 8509-93': {
      name: 'Уголки стальные горячекатаные равнополочные',
      description: 'Настоящий стандарт распространяется на стальные горячекатаные равнополочные уголки.',
      scope: 'Металлические конструкции',
      year: '1993',
      status: 'Действующий',
    },
    'ГОСТ 19281-2014': {
      name: 'Прокат из стали повышенной прочности',
      description: 'Настоящий стандарт распространяется на горячекатаный листовой и фасонный прокат из стали повышенной прочности.',
      scope: 'Металлургия',
      year: '2014',
      status: 'Действующий',
    },
    'ГОСТ 380-2005': {
      name: 'Сталь углеродистая обыкновенного качества',
      description: 'Настоящий стандарт распространяется на углеродистую сталь обыкновенного качества в слитках, блюмах, заготовках и прокате.',
      scope: 'Металлургическая промышленность',
      year: '2005',
      status: 'Действующий',
    },
  };

  const currentGost = gostInfo[gost] || {
    name: 'Информация о ГОСТе',
    description: 'Описание стандарта недоступно',
    scope: 'Не указано',
    year: 'Не указан',
    status: 'Неизвестно',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {gost}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
          <p className="text-gray-600 mt-1">{currentGost.name}</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Описание</h3>
            <p className="text-gray-700 leading-relaxed">{currentGost.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Область применения</h3>
              <p className="text-gray-900">{currentGost.scope}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Год принятия</h3>
              <p className="text-gray-900">{currentGost.year}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Статус</h3>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
              {currentGost.status}
            </span>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
              <i className="ri-settings-line mr-2"></i>
              Применение в продукте
            </h3>
            <p className="text-sm text-gray-600">
              Данный ГОСТ регламентирует производство и качество продукции {product.name} от поставщика {product.supplier}.
            </p>
          </div>

          <div className="flex justify-between items-center gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Закрыть
            </button>
            <Link href={`/gost/${encodeURIComponent(gost)}`}>
              <button className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors cursor-pointer whitespace-nowrap">
                Подробнее
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
