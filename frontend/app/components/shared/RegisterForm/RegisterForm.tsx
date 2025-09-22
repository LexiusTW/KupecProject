'use client';

import { useRef, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { RegisterFormData, Role } from '../../types';

import { Input } from '../../base/Input/Input';
import { Button } from '../../ui/Button/Button';

import css from './RegisterForm.module.css';

const API_BASE_URL = 'https://ekbmetal.cloudpub.ru';

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
            phone_number: data.phone_number,
            director_name: data.director_name,
            legal_address: data.legal_address,
            inn: data.inn,
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

      router.push('/search');
    } catch (e: any) {
      setError(e.message || 'Ошибка регистрации. Попробуйте снова.');
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className={css.box}>
      <div className={css['inner-btns']}>
        <button 
          type="button" 
          onClick={() => handleTabChange('buyer')} 
          className={`flex-1 py-2 text-center font-medium ${activeTab === 'buyer' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Покупатель
        </button>
        <button 
          type="button" 
          onClick={() => handleTabChange('seller')} 
          className={`flex-1 py-2 text-center font-medium ${activeTab === 'seller' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Продавец
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className={css.form}>
        <div className={css.inputs}>
          <Input<RegisterFormData>
            label="Логин"
            name="login"
            type="text"
            register={register}
            error={errors.login}
            required="Логин обязателен"
            className="mb-4"
          />

          <Input<RegisterFormData>
            label="Пароль"
            name="password"
            type="password"
            register={register}
            error={errors.password}
            required="Пароль обязателен"
            className="mb-4"
          />

          {/* Поля для продавца */}
          {activeTab === 'seller' && (
            <>
              <Input<RegisterFormData>
                label="Телефон ответственного"
                name="phone_number"
                type="tel"
                register={register}
                error={errors.phone_number}
                required="Номер обязателен"
                className="mb-4"
              />

              <Input<RegisterFormData>
                label="ФИО директора"
                name="director_name"
                type="text"
                register={register}
                error={errors.director_name}
                required="ФИО обязательно"
                className="mb-4"
              />

              <Input<RegisterFormData>
                label="Юридический адрес"
                name="legal_address"
                type="text"
                register={register}
                error={errors.legal_address}
                required="Юр. адрес обязателен"
                className="mb-4"
              />

              <Input<RegisterFormData>
                label="ИНН"
                name="inn"
                type="text"
                register={register}
                error={errors.inn}
                required="ИНН обязателен"
                className="mb-4"
              />
            </>
          )}
        </div>

        {error && <p className="text-sm text-red-600 text-center py-2">{error}</p>}

        <div className={css.btns}>
          <Button text= {isLoading ? 'Регистрируем...' : 'Зарегистрироваться'} type='submit'  disabled={isLoading}  variant='orange'/>
        </div>

        <footer className={css.footer}>
          <p className={css.p1}>
            Нет аккаунта?{" "}

            <Link
              href="/login"
              className={css.link}
            >
              Войти
            </Link>
          </p>
        </footer>
      </form>
    </div>
  );
}