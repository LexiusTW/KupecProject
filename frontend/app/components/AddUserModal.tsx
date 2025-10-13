'use client';

import { useRef, useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import Notification, { NotificationProps } from './Notification';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

import { UserRole } from '../users/types';

// --- Типы ---

interface AddUserFormData {
  login: string;
  password: string;
  email: string;
  role: UserRole;
  employee_name: string;
  phone_number?: string;
}

interface CurrentUser {
  id: number;
  login: string;
  role: 'Директор' | 'РОП';
}

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: CurrentUser | null;
  onUserAdded: () => void; // Callback to refresh user list
}

export default function AddUserModal({ isOpen, onClose, currentUser, onUserAdded }: AddUserModalProps) {
  const [notifications, setNotifications] = useState<Omit<NotificationProps, 'onDismiss'>[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const modalContentRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, formState: { errors }, control, reset, watch } = useForm<AddUserFormData>({
    defaultValues: {
      login: '',
      password: '',
      email: '',
      role: 'Менеджер', // Default role
      employee_name: '',
      phone_number: '',
    },
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  const addNotification = (notif: Omit<NotificationProps, 'id' | 'onDismiss'>) => {
    const id = new Date().toISOString();
    setNotifications(prev => [...prev, { ...notif, id }]);
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Close modal on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalContentRef.current && !modalContentRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const onSubmit: SubmitHandler<AddUserFormData> = async (data) => {
    setIsLoading(true);
    const endpoint = `${API_BASE_URL}/api/v1/users`;

    const payload = {
      ...data,
      phone_number: data.phone_number?.replace(/\D/g, ''),
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
        throw new Error(er.detail || 'Ошибка при создании пользователя');
      }

      addNotification({ title: 'Успех', message: 'Пользователь успешно создан!', type: 'success' });
      onUserAdded(); // Refresh the list
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (e: any) {
      addNotification({ title: 'Ошибка', message: e.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneNumberChange = (e: ChangeEvent<HTMLInputElement>, field: any) => {
    const input = e.target;
    const digits = input.value.replace(/\D/g, '');
    const matrix = "+7 (___) ___-__-__";
    let i = 0;
    const formattedValue = matrix.replace(/./g, (char) => {
      if (/[_\d]/.test(char) && i < digits.length) {
        return digits[i++];
      } else if (i >= digits.length) {
        return "";
      }
      return char;
    });
    field.onChange(formattedValue);
    const setCursorToEnd = () => {
      input.selectionStart = input.selectionEnd = formattedValue.length;
    };
    requestAnimationFrame(setCursorToEnd);
  };

  if (!isOpen) return null;

  const input = "mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-amber-500 focus:border-amber-500";
  const label = "block text-sm font-medium text-gray-700";
  const err = "mt-1 text-sm text-red-600";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out animate-fadeIn">
      <div ref={modalContentRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-8 transform transition-transform duration-300 ease-in-out animate-scaleIn">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Добавить нового пользователя</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="ri-close-line text-2xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="login" className={label}>Логин</label>
            <input id="login" type="text" {...register('login', { required: 'Логин обязателен' })} className={input} autoComplete="username" />
            {errors.login && <p className={err}>{errors.login.message}</p>}
          </div>

          <div className="relative">
            <label htmlFor="password" className={label}>Пароль</label>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              {...register('password', { required: 'Пароль обязателен', minLength: { value: 8, message: 'Не менее 8 символов' } })}
              className={input}
              autoComplete="new-password"
            />
            {watch('password') && (
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 top-7 pr-3 flex items-center text-gray-500">
                <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
              </button>
            )}
            {errors.password && <p className={err}>{errors.password.message}</p>}
          </div>

          <div>
            <label htmlFor="email" className={label}>Email</label>
            <input id="email" type="email" {...register('email', { required: 'Email обязателен' })} className={input} autoComplete="email" />
            {errors.email && <p className={err}>{errors.email.message}</p>}
          </div>

          {currentUser?.role === 'Директор' && (
            <div>
              <label htmlFor="role" className={label}>Роль</label>
              <select id="role" {...register('role', { required: 'Роль обязательна' })} className={input}>
                <option value="РОП">РОП</option>
                <option value="Менеджер">Менеджер</option>
                <option value="Снабженец">Снабженец</option>
              </select>
              {errors.role && <p className={err}>{errors.role.message}</p>}
            </div>
          )}

          <div>
            <label htmlFor="employee_name" className={label}>ФИО сотрудника</label>
            <input id="employee_name" type="text" {...register('employee_name', { required: 'ФИО сотрудника обязательно' })} className={input} autoComplete="name" />
            {errors.employee_name && <p className={err}>{errors.employee_name.message}</p>}
          </div>

          <div>
            <label htmlFor="phone_number" className={label}>Телефон</label>
            <Controller
              name="phone_number"
              control={control}
              render={({ field }) => (
                <input
                  id="phone_number"
                  type="tel"
                  placeholder='+7 (999) 999-99-99'
                  {...field}
                  onChange={(e) => handlePhoneNumberChange(e, field)}
                  className={input}
                  autoComplete="off"
                  maxLength={18}
                />
              )}
            />
          </div>

          <div className="pt-4">
            <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition">
              {isLoading ? 'Создание...' : 'Создать пользователя'}
            </button>
          </div>
        </form>
      </div>
      <div className="fixed top-24 right-4 z-50 space-y-2">
        {notifications.map(notif => (
          <Notification key={notif.id} {...notif} onDismiss={dismissNotification} />
        ))}
      </div>
    </div>
  );
}

// Добавим немного CSS для анимаций в globals.css или прямо здесь в <style>
// Я добавлю их в globals.css, но для примера покажу здесь:
/*
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.animate-fadeIn {
  animation: fadeIn 0.2s ease-out forwards;
}

.animate-scaleIn {
  animation: scaleIn 0.2s ease-out forwards;
}
*/
