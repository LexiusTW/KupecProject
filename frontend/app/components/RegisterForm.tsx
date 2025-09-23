'use client';

import { useRef, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { RegisterFormData, Role } from './types';

const API_BASE_URL = 'https://kupecbek.cloudpub.ru';

export default function RegisterForm() {
  const [activeTab, setActiveTab] = useState<Role>('buyer');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const submittingRef = useRef(false);
  const router = useRouter();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<RegisterFormData>();

  const handleTabChange = (tab: Role) => {
    setActiveTab(tab);
    setError(null);
    reset();
  };

  const onSubmit: SubmitHandler<RegisterFormData> = async (data) => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    setIsLoading(true);
    setError(null);

    const endpoint =
      activeTab === 'buyer'
        ? `${API_BASE_URL}/api/v1/register/buyer`
        : `${API_BASE_URL}/api/v1/register/seller`;

    const payload =
      activeTab === 'buyer'
        ? { login: data.login, password: data.password }
        : {
            login: data.login,
            password: data.password,
            phone_number: data.phone_number,   // номер телефона ответственного
            director_name: data.director_name, // ФИО директора
            legal_address: data.legal_address, // юридический адрес
            inn: data.inn,                     // ИНН
          };

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const er = await resp.json().catch(() => ({}));
        throw new Error(er.detail || 'Ошибка регистрации');
      }

      router.push('/request');
    } catch (e: any) {
      setError(e.message || 'Ошибка регистрации. Попробуйте снова.');
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
    }
  };

  const input = "mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-amber-500 focus:border-amber-500";
  const label = "block text-sm font-medium text-gray-700";
  const err = "mt-1 text-sm text-red-600";

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg max-w-xl mx-auto">
      <div className="flex border-b mb-6">
        <button type="button" onClick={() => handleTabChange('buyer')} className={`flex-1 py-2 text-center font-medium ${activeTab==='buyer'?'text-amber-600 border-b-2 border-amber-600':'text-gray-500 hover:text-gray-700'}`}>Покупатель</button>
        <button type="button" onClick={() => handleTabChange('seller')} className={`flex-1 py-2 text-center font-medium ${activeTab==='seller'?'text-amber-600 border-b-2 border-amber-600':'text-gray-500 hover:text-gray-700'}`}>Продавец</button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Общие поля */}
        <div>
          <label htmlFor="login" className={label}>Логин</label>
          <input id="login" type="text" {...register('login', { required: 'Логин обязателен' })} className={input} />
          {errors.login && <p className={err}>{errors.login.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className={label}>Пароль</label>
          <input id="password" type="password" {...register('password', { required: 'Пароль обязателен', minLength: { value: 8, message: 'Не менее 8 символов' } })} className={input} />
          {errors.password && <p className={err}>{errors.password.message}</p>}
        </div>

        {/* Продавец */}
        {activeTab === 'seller' && (
          <>
            <div>
              <label htmlFor="phone_number" className={label}>Телефон ответственного</label>
              <input id="phone_number" type="tel" {...register('phone_number', { required: 'Номер обязателен' })} className={input} />
              {errors.phone_number && <p className={err}>{errors.phone_number.message}</p>}
            </div>
            <div>
              <label htmlFor="director_name" className={label}>ФИО директора</label>
              <input id="director_name" type="text" {...register('director_name', { required: 'ФИО обязательно' })} className={input} />
              {errors.director_name && <p className={err}>{errors.director_name.message}</p>}
            </div>
            <div>
              <label htmlFor="legal_address" className={label}>Юридический адрес</label>
              <input id="legal_address" type="text" {...register('legal_address', { required: 'Юр. адрес обязателен' })} className={input} />
              {errors.legal_address && <p className={err}>{errors.legal_address.message}</p>}
            </div>
            <div>
              <label htmlFor="inn" className={label}>ИНН</label>
              <input id="inn" type="text" {...register('inn', { required: 'ИНН обязателен', pattern: { value: /^\d{10}$|^\d{12}$/, message: 'ИНН должен содержать 10 или 12 цифр' } })} className={input} />
              {errors.inn && <p className={err}>{errors.inn.message}</p>}
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600 text-center py-2">{error}</p>}

        <button type="submit" disabled={isLoading} className="w-full bg-amber-600 text-white py-2 px-4 rounded-md hover:bg-amber-700 disabled:opacity-50">
          {isLoading ? 'Регистрируем...' : 'Зарегистрироваться'}
        </button>

        <p className="text-center text-sm text-gray-600">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="font-medium text-amber-600 hover:text-amber-500">Войти</Link>
        </p>
      </form>
    </div>
  );
}
