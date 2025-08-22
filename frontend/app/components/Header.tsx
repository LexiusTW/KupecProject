'use client';

import Image from 'next/image';

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        {/* Логотип */}
        <div className="relative h-16 w-48 flex items-center">
          <Image
            src="/images/logo.png"
            alt="PromTrade Logo"
            fill
            className="object-contain"
            priority
          />
        </div>
        {/* Навигация */}
        <nav className="flex items-center space-x-8">
          <a href="#search" className="text-gray-700 hover:text-amber-600 transition-colors cursor-pointer">
            Поиск
          </a>
          <a href="/account" className="text-gray-700 hover:text-amber-600 transition-colors cursor-pointer">
            Личный кабинет
          </a>
        </nav>
      </div>
    </header>
  );
}
