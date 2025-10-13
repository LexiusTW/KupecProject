'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

type UserRole = 'Директор' | 'РОП' | 'Менеджер' | 'Снабженец' | 'Продавец';

interface User {
  id: number;
  login: string;
  role: UserRole;
}

export default function Header({ showNav = true }: { showNav?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const isAuthPage = pathname?.startsWith('/auth');

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    // Мгновенно уводим на /login, а запрос на logout отправляем асинхронно
    router.push('/auth');
    try {
      fetch(`${API_BASE_URL}/api/v1/logout`, {
        method: 'POST',
        credentials: 'include',
        keepalive: true as any,
      }).catch(() => {});
    } finally {
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
          credentials: 'include',
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    };
    fetchUser();
  }, []);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        {/* Логотип */}
        <div className="relative h-16 w-48 flex items-center">
          <Image
            src="/images/logo.png"
            alt="logo"
            fill
            className="object-contain"
            priority
            draggable="false"
            onDragStart={(e) => e.preventDefault()}
          />
        </div>

        {/* Навигация */}
        {showNav && !isAuthPage ? (
          <nav className="flex items-center space-x-8">
            
            {user && (user.role === 'Директор' || user.role === 'РОП') && (
              <Link href="/users" className="text-gray-700 hover:text-amber-600 transition-colors">
                Управление
              </Link>
            )}

            <Link href="/account" className="text-gray-700 hover:text-amber-600 transition-colors">
              Личный кабинет
            </Link>

            <Link
              href="/request"
              className="border border-amber-600 text-amber-700 px-4 py-2 rounded-md hover:bg-amber-50"
            >
              Заявки
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