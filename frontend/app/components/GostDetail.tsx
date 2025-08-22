'use client';

import Link from 'next/link';

export default function GostDetail({ gostId }: { gostId: string }) {
  const gostDatabase = {
    'ГОСТ 8239-89': {
      name: 'Двутавры стальные горячекатаные. Сортамент',
      description: 'Настоящий стандарт распространяется на стальные горячекатаные двутавры, предназначенные для строительных металлических конструкций.',
      fullDescription: 'Стандарт устанавливает сортамент стальных горячекатаных двутавров с уклоном внутренних граней полок и с параллельными гранями полок, предназначенных для строительных металлических конструкций. Двутавры изготавливают из углеродистой стали обыкновенного качества по ГОСТ 380 и из низколегированной стали по ГОСТ 19281.',
      scope: 'Строительные металлические конструкции',
      year: '1989',
      status: 'Действующий',
      replaced: 'ГОСТ 8239-72',
      sections: [
        {
          title: '1. Область применения',
          content: 'Настоящий стандарт распространяется на стальные горячекатаные двутавры с уклоном внутренних граней полок и с параллельными гранями полок, предназначенные для строительных металлических конструкций.'
        },
        {
          title: '2. Нормативные ссылки',
          content: 'В настоящем стандарте использованы ссылки на следующие стандарты: ГОСТ 380-2005, ГОСТ 19281-2014, ГОСТ 1050-2013.'
        },
        {
          title: '3. Сортамент',
          content: 'Двутавры изготавливают высотой от 100 до 1000 мм согласно размерам, указанным в таблице 1. Предельные отклонения размеров двутавров не должны превышать значений, приведенных в таблице 2.'
        },
        {
          title: '4. Технические требования',
          content: 'Двутавры изготавливают из углеродистой стали обыкновенного качества по ГОСТ 380 и из низколегированной стали по ГОСТ 19281. Механические свойства стали должны соответствовать требованиям указанных стандартов.'
        }
      ],
      tables: [
        {
          title: 'Основные размеры двутавров',
          headers: ['Номер', 'h, мм', 'b, мм', 's, мм', 't, мм', 'R, мм', 'Масса 1 м, кг'],
          rows: [
            ['10', '100', '55', '4.5', '7.2', '7', '9.46'],
            ['12', '120', '64', '4.8', '7.3', '7.5', '11.5'],
            ['14', '140', '73', '4.9', '7.5', '8', '13.7'],
            ['16', '160', '81', '5.0', '7.8', '8.5', '15.9'],
            ['18', '180', '90', '5.1', '8.1', '9', '18.4']
          ]
        }
      ]
    },
    'ГОСТ 8240-97': {
      name: 'Швеллеры стальные горячекатаные. Сортамент',
      description: 'Настоящий стандарт распространяется на стальные горячекатаные швеллеры, применяемые в строительных металлических конструкциях.',
      fullDescription: 'Стандарт устанавливает сортамент стальных горячекатаных швеллеров с уклоном внутренних граней полок и с параллельными гранями полок. Швеллеры предназначены для использования в строительных металлических конструкциях различного назначения.',
      scope: 'Строительные конструкции',
      year: '1997',
      status: 'Действующий',
      replaced: 'ГОСТ 8240-89',
      sections: [
        {
          title: '1. Область применения',
          content: 'Настоящий стандарт распространяется на стальные горячекатаные швеллеры с уклоном внутренних граней полок и с параллельными гранями полок, применяемые в строительных металлических конструкциях.'
        },
        {
          title: '2. Сортамент и размеры',
          content: 'Швеллеры изготавливают высотой от 50 до 400 мм. Размеры швеллеров и предельные отклонения должны соответствовать указанным в стандарте значениям.'
        }
      ],
      tables: [
        {
          title: 'Размеры швеллеров',
          headers: ['Номер', 'h, мм', 'b, мм', 's, мм', 't, мм', 'Масса 1 м, кг'],
          rows: [
            ['5', '50', '32', '4.4', '7.0', '4.84'],
            ['6.5', '65', '36', '4.4', '7.2', '5.90'],
            ['8', '80', '40', '4.5', '7.4', '7.05'],
            ['10', '100', '46', '4.5', '7.6', '8.59'],
            ['12', '120', '52', '4.8', '7.8', '10.4']
          ]
        }
      ]
    }
  };

  const gost = gostDatabase[gostId as keyof typeof gostDatabase] || {
    name: 'ГОСТ не найден',
    description: 'Информация о данном ГОСТе отсутствует в базе данных.',
    fullDescription: 'К сожалению, подробная информация о данном стандарте недоступна.',
    scope: 'Не указано',
    year: 'Не указан',
    status: 'Неизвестно',
    sections: [],
    tables: []
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/">
            <button className="inline-flex items-center text-amber-600 hover:text-amber-800 mb-4 cursor-pointer">
              <div className="w-4 h-4 flex items-center justify-center mr-2">
                <i className="ri-arrow-left-line"></i>
              </div>
              Вернуться к поиску
            </button>
          </Link>
          
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {gostId}
                </h1>
                <h2 className="text-xl text-gray-700 mb-4">
                  {gost.name}
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  {gost.description}
                </p>
              </div>
              <div className="ml-6">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  {gost.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-gray-200">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Область применения</h3>
                <p className="text-gray-900">{gost.scope}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Год принятия</h3>
                <p className="text-gray-900">{gost.year}</p>
              </div>
              {gost.replaced && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Заменил</h3>
                  <p className="text-gray-900">{gost.replaced}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Full Description */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Полное описание</h2>
          <p className="text-gray-700 leading-relaxed">
            {gost.fullDescription}
          </p>
        </div>

        {/* Sections */}
        {gost.sections && gost.sections.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Разделы стандарта</h2>
            <div className="space-y-6">
              {gost.sections.map((section, index) => (
                <div key={index} className="border-l-4 border-amber-500 pl-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {section.title}
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tables */}
        {gost.tables && gost.tables.length > 0 && (
          <div className="space-y-8">
            {gost.tables.map((table, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {table.title}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {table.headers.map((header, headerIndex) => (
                          <th 
                            key={headerIndex}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {table.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-gray-50">
                          {row.map((cell, cellIndex) => (
                            <td 
                              key={cellIndex}
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Additional Information */}
        <div className="bg-amber-50 rounded-xl p-6 mt-8">
          <h2 className="text-lg font-semibold text-amber-900 mb-3">
            <div className="w-5 h-5 flex items-center justify-center inline-block mr-2">
              <i className="ri-information-line"></i>
            </div>
            Дополнительная информация
          </h2>
          <p className="text-amber-800 leading-relaxed">
            Данный стандарт является обязательным для применения на территории Российской Федерации. 
            Актуальная версия документа и все изменения публикуются на официальном сайте Росстандарта.
            Для получения полного текста стандарта обратитесь к официальным источникам.
          </p>
        </div>
      </div>
    </div>
  );
}