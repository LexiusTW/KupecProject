'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Tab } from '@headlessui/react';
import { useRouter } from 'next/navigation';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

const API_BASE_URL = 'https://ekbmetal.cloudpub.ru';

export default function AuthForm() {
  const [, setAuthMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'Покупатель' | 'Продавец'>('Покупатель');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm();

  const handleTabChange = (index: number) => {
    setAuthMode(index === 0 ? 'login' : 'register');
    setError(null);
    setSuccess(null);
    reset();
  };

  const onLoginSubmit = async (data: any) => {
    setError(null);
    setSuccess(null);
    try {
      const formData = new URLSearchParams();
      formData.append('username', data.login);
      formData.append('password', data.password);

      const response = await fetch(`${API_BASE_URL}/api/v1/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Ошибка входа');

      localStorage.setItem('accessToken', result.access_token);
      setSuccess('Вход выполнен успешно! Перенаправление...');
      setTimeout(() => router.push('/'), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const onRegisterSubmit = async (data: any) => {
    setError(null);
    setSuccess(null);
    
    if (data.password !== data.confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    const payload = { role, ...data };
    delete payload.confirmPassword;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Ошибка регистрации');

      setSuccess('Регистрация прошла успешно! Теперь вы можете войти.');
      reset();
      setAuthMode('login');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const renderInputField = (id: string, label: string, type: string, required: boolean, placeholder?: string) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={id}
        type={type}
        {...register(id, { required })}
        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
        placeholder={placeholder}
      />
      {errors[id] && <p className="mt-1 text-xs text-red-600">Это поле обязательно.</p>}
    </div>
  );

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg w-full">
      <Tab.Group onChange={handleTabChange}>
        <Tab.List className="flex space-x-1 rounded-xl bg-amber-900/20 p-1">
          <Tab className={({ selected }) => classNames('w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-amber-700', 'ring-white ring-opacity-60 ring-offset-2 ring-offset-amber-400 focus:outline-none focus:ring-2', selected ? 'bg-white shadow' : 'text-amber-100 hover:bg-white/[0.12] hover:text-white')}>Вход</Tab>
          <Tab className={({ selected }) => classNames('w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-amber-700', 'ring-white ring-opacity-60 ring-offset-2 ring-offset-amber-400 focus:outline-none focus:ring-2', selected ? 'bg-white shadow' : 'text-amber-100 hover:bg-white/[0.12] hover:text-white')}>Регистрация</Tab>
        </Tab.List>
        <Tab.Panels className="mt-6">
          <Tab.Panel as="div" className="space-y-6">
            <h2 className="text-2xl font-bold text-center text-gray-800">Вход в аккаунт</h2>
            <form onSubmit={handleSubmit(onLoginSubmit)} className="space-y-4">
              {renderInputField('login', 'Логин или ИНН', 'text', true, 'Введите логин или ИНН')}
              {renderInputField('password', 'Пароль', 'password', true, 'Введите пароль')}
              <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50">
                {isSubmitting ? 'Вход...' : 'Войти'}
              </button>
            </form>
          </Tab.Panel>
          <Tab.Panel as="div" className="space-y-6">
            <h2 className="text-2xl font-bold text-center text-gray-800">Создание аккаунта</h2>
            <Tab.Group onChange={(index) => setRole(index === 0 ? 'Покупатель' : 'Продавец')}>
              <Tab.List className="flex space-x-1 rounded-md bg-gray-200 p-1">
                <Tab className={({ selected }) => classNames('w-full rounded-md py-2 text-sm font-medium', selected ? 'bg-white shadow text-amber-700' : 'text-gray-600 hover:bg-white/50')}>Покупатель</Tab>
                <Tab className={({ selected }) => classNames('w-full rounded-md py-2 text-sm font-medium', selected ? 'bg-white shadow text-amber-700' : 'text-gray-600 hover:bg-white/50')}>Продавец</Tab>
              </Tab.List>
            </Tab.Group>
            <form onSubmit={handleSubmit(onRegisterSubmit)} className="space-y-4">
              {renderInputField('login', 'Логин', 'text', true, 'Придумайте логин')}
              {renderInputField('password', 'Пароль', 'password', true, 'Не менее 8 символов')}
              {renderInputField('confirmPassword', 'Подтвердите пароль', 'password', true, 'Повторите пароль')}
              
              {role === 'Продавец' && (
                <>
                  <hr/>
                  <p className="text-sm text-center text-gray-500">Заполните данные организации</p>
                  {renderInputField('inn', 'ИНН', 'text', true, '10 или 12 цифр')}
                  {renderInputField('director_name', 'ФИО директора', 'text', true, 'Иванов Иван Иванович')}
                  {renderInputField('phone_number', 'Контактный телефон', 'tel', true, '+7 (999) 999-99-99')}
                  {renderInputField('legal_address', 'Юридический адрес', 'text', true, 'Город, улица, дом')}
                </>
              )}
              <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50">
                {isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>
            </form>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
      {error && <div className="mt-4 text-sm text-red-600 text-center p-2 bg-red-50 rounded-md">{error}</div>}
      {success && <div className="mt-4 text-sm text-green-600 text-center p-2 bg-green-50 rounded-md">{success}</div>}
    </div>
  );
}