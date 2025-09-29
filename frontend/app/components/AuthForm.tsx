'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AuthFormData } from './types';
import Notification, { NotificationProps } from './Notification';

const API_BASE_URL = 'https://kupecbek.cloudpub.ru';

export default function AuthForm() {
  const [notifications, setNotifications] = useState<Omit<NotificationProps, 'onDismiss'>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const checkingRef = useRef(false);
  const submittingRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<AuthFormData>();

  const addNotification = (notif: Omit<NotificationProps, 'id' | 'onDismiss'>) => {
    const id = new Date().toISOString();
    setNotifications(prev => [...prev, { ...notif, id }]);
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  useEffect(() => {
    if (checkingRef.current) return;
    checkingRef.current = true;

    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/v1/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (r.ok) {
          const nextUrl = searchParams.get('next') || '/request';
          router.replace(nextUrl);
        }
      } catch {
      }
    })();
  }, [router, searchParams]);

  const onSubmit: SubmitHandler<AuthFormData> = async (data) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ login: data.login, password: data.password }),
      });

      if (!response.ok) {
        const er = await response.json().catch(() => ({}));
        throw new Error(er.detail || 'Неверный логин или пароль');
      }

      const nextUrl = searchParams.get('next') || '/request';
      router.push(nextUrl);
    } catch (e: any) {
      addNotification({ title: 'Ошибка', message: e.message || 'Ошибка входа. Попробуйте снова.', type: 'error' });
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
    }
  };

  const input = "mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-amber-500 focus:border-amber-500";
  const label = "block text-sm font-medium text-gray-700";
  const err = "mt-1 text-sm text-red-600";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="fixed top-24 right-4 z-50 space-y-2">
        {notifications.map(notif => (
          <Notification key={notif.id} {...notif} onDismiss={dismissNotification} />
        ))}
      </div>

      <div>
        <label htmlFor="login" className={label}>Логин или Email</label>
        <input id="login" type="text" {...register('login', { required: 'Логин или Email обязателен' })} className={input} />
        {errors.login && <p className={err}>{errors.login.message}</p>}
      </div>

      <div className="relative">
        <label htmlFor="password" className={label}>Пароль</label>
        <input
          id="password"
          type={showPassword ? 'text' : 'password'}
          {...register('password', { required: 'Пароль обязателен' })}
          className={input}
        />
        {watch('password') && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 top-7 pr-3 flex items-center text-gray-500"
          >
            <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
          </button>
        )}
        {errors.password && <p className={err}>{errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-amber-600 text-white py-2 px-4 rounded-md hover:bg-amber-700 disabled:opacity-50"
      >
        {isLoading ? 'Входим...' : 'Войти'}
      </button>
    </form>
  );
}
