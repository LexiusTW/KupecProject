'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { User, UserRole, CurrentUser } from '../users/types';


const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  currentUser: CurrentUser | null;
  onUserUpdated: () => void;
}

const userRoles: UserRole[] = ['РОП', 'Менеджер', 'Снабженец'];
const clsInput = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500';

const formatPhoneNumber = (value: string) => {
  if (!value) return value;
  const digits = value.replace(/\D/g, '');
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
  return formattedValue;
};


export default function EditUserModal({ isOpen, onClose, user, currentUser, onUserUpdated }: EditUserModalProps) {
  const [formData, setFormData] = useState({
    employee_name: '',
    email: '',
    phone_number: '',
    role: '' as UserRole | '',
    parent_id: null as number | null,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        employee_name: user.employee_name,
        email: user.email,
        phone_number: formatPhoneNumber(user.phone_number || ''),
        role: user.role,
        parent_id: user.parent_id,
      });
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhoneNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const formattedValue = formatPhoneNumber(input.value);
    
    setFormData(prev => ({ ...prev, phone_number: formattedValue }));

    const setCursorToEnd = () => {
      input.selectionStart = input.selectionEnd = formattedValue.length;
    };
    requestAnimationFrame(setCursorToEnd);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const userUpdateData = {
        employee_name: formData.employee_name,
        email: formData.email,
        phone_number: formData.phone_number.replace(/\D/g, ''),
        role: formData.role,
        parent_id: formData.parent_id,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users/${user.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(userUpdateData),
        }
      );

      if (response.ok) {
        onUserUpdated();
        onClose();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Не удалось обновить пользователя');
      }
    } catch (err) {
      setError('Произошла ошибка сети');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Редактировать пользователя</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="employee_name" className="block text-sm font-medium text-gray-700">ФИО</label>
            <input type="text" name="employee_name" id="employee_name" value={formData.employee_name} onChange={handleChange} className={clsInput} required />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} className={clsInput} required />
          </div>
          <div>
            <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">Номер телефона</label>
            <input 
              type="tel" 
              name="phone_number" 
              id="phone_number" 
              value={formData.phone_number} 
              onChange={handlePhoneNumberChange} 
              className={clsInput} 
              placeholder="+7 (999) 999-99-99"
              maxLength={18}
            />
          </div>
          {currentUser?.role === 'Директор' && (
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">Роль</label>
              <select name="role" id="role" value={formData.role} onChange={handleChange} className={clsInput} required>
                {userRoles.map(role => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex justify-end space-x-4 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
              Отмена
            </button>
            <button type="submit" className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
