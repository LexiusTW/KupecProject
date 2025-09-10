'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const API_BASE_URL = 'https://ekbmetal.cloudpub.ru';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/register');

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch(`${API_BASE_URL}/api/v1/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
    } finally {
      setIsLoggingOut(false);
      router.push('/login');
    }
  };

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
        {!isAuthPage ? (
          <nav className="flex items-center space-x-8">
            <Link href="/search" className="text-gray-700 hover:text-amber-600 transition-colors">
              Поиск
            </Link>

            <Link href="/account" className="text-gray-700 hover:text-amber-600 transition-colors">
              Личный кабинет
            </Link>

            <Link href="/mail" className="text-gray-700 hover:text-amber-600 transition-colors">
              Почта
            </Link>

            <Link
              href="/request"
              className="border border-amber-600 text-amber-700 px-4 py-2 rounded-md hover:bg-amber-50"
            >
              Оставить заявку
            </Link>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="ml-2 bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 disabled:opacity-50"
            >
              {isLoggingOut ? 'Выходим…' : 'Выйти'}
            </button>
          </nav>
        ) : (
          <div />
        )}
      </div>
    </header>
  );
}
