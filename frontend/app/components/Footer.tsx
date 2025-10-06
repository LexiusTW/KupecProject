'use client';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-gray-600">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">ООО &quot;Купец&quot;</h3>
            <p className="text-sm">ИНН: 1234567890</p>
            <p className="text-sm">ОГРН: 1234567890123</p>
            <p className="text-sm">г. Екатеринбург, ул. Металлургов, д. 1</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Документация</h3>
            <ul className="space-y-2 text-sm">
              <li>
                ГОСТы и ТУ
              </li>
              <li>
                Шаблонные договоры
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Информация</h3>
            <p className="text-sm">
              © {new Date().getFullYear()} Купец. Все права защищены.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
