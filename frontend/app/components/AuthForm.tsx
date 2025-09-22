'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { AuthFormData } from './types';

const API_BASE_URL = 'https://kupecbek.cloudpub.ru';

export default function AuthForm() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const checkingRef = useRef(false);
  const submittingRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const { register, handleSubmit, formState: { errors } } = useForm<AuthFormData>();

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
          const nextUrl = searchParams.get('next') || '/search';
          router.replace(nextUrl);
        }
      } catch {
      }
    })();
  }, [router]);

  const onSubmit: SubmitHandler<AuthFormData> = async (data) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    setError(null);

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

      const nextUrl = searchParams.get('next') || '/search';
      router.push(nextUrl);
    } catch (e: any) {
      setError(e.message || 'Ошибка входа. Попробуйте снова.');
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
    }
  };

  const input = "mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-amber-500 focus:border-amber-500";
  const label = "block text-sm font-medium text-gray-700";
  const err = "mt-1 text-sm text-red-600";

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg max-w-md mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="login" className={label}>Логин</label>
          <input id="login" type="text" {...register('login', { required: 'Логин обязателен' })} className={input} />
          {errors.login && <p className={err}>{errors.login.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className={label}>Пароль</label>
          <input id="password" type="password" {...register('password', { required: 'Пароль обязателен' })} className={input} />
          {errors.password && <p className={err}>{errors.password.message}</p>}
        </div>

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-amber-600 text-white py-2 px-4 rounded-md hover:bg-amber-700 disabled:opacity-50"
        >
          {isLoading ? 'Входим...' : 'Войти'}
        </button>

        <p className="text-center text-sm text-gray-600">
          Нет аккаунта?{' '}
          <Link href="/register" className="font-medium text-amber-600 hover:text-amber-500">
            Зарегистрироваться
          </Link>
        </p>
      </form>
    </div>
  );
}
