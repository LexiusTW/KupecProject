'use client';

import { useRef, useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import type { RegisterFormData, DaDataParty, DaDataAddr, OrganizationFormData } from './types';
import Notification, { NotificationProps } from './Notification';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function RegisterForm() {
  const [notifications, setNotifications] = useState<Omit<NotificationProps, 'onDismiss'>[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const submittingRef = useRef(false);
  const router = useRouter();

  const { register, handleSubmit, formState: { errors }, control, setValue, watch } = useForm<RegisterFormData>({
    defaultValues: {
      login: '',
      password: '',
      email: '',
      role: 'Директор',
      employee_name: '',
      phone_number: '',
      organization: {
        company_name: '',
        inn: '',
        ogrn: '',
        legal_address: '',
        director_name: '',
      }
    },
  });

  const addNotification = (notif: Omit<NotificationProps, 'id' | 'onDismiss'>) => {
    const id = new Date().toISOString();
    setNotifications(prev => [...prev, { ...notif, id }]);
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // DaData states
  const [dadataQuery, setDadataQuery] = useState('');
  const [dadataSugg, setDadataSugg] = useState<DaDataParty[]>([]);
  const [dadataFocus, setDadataFocus] = useState(false);
  const [dadataLoading, setDadataLoading] = useState(false);
  const dadataAbort = useRef<AbortController | null>(null);

  const [addrQuery, setAddrQuery] = useState('');
  const [addrSugg, setAddrSugg] = useState<DaDataAddr[]>([]);
  const [addrFocus, setAddrFocus] = useState(false);
  const [addrLoading, setAddrLoading] = useState(false);
  const addrAbort = useRef<AbortController | null>(null);
  
  const legalAddressValue = watch('organization.legal_address');

  useEffect(() => {
    setAddrQuery(legalAddressValue || '');
  }, [legalAddressValue]);


  const onSubmit: SubmitHandler<RegisterFormData> = async (data) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);

    const endpoint = `${API_BASE_URL}/api/v1/register`;

    const payload = {
      login: data.login,
      password: data.password,
      email: data.email,
      role: data.role,
      employee_name: data.employee_name,
      phone_number: data.phone_number?.replace(/\D/g, ''),
      organization: {
        company_name: data.organization.company_name,
        inn: data.organization.inn,
        ogrn: data.organization.ogrn,
        legal_address: data.organization.legal_address,
        director_name: data.organization.director_name,
        kpp: data.organization.kpp || undefined,
        okpo: data.organization.okpo || undefined,
        okato_oktmo: data.organization.okato_oktmo || undefined,
        bank_account: data.organization.bank_account || undefined,
        correspondent_account: data.organization.correspondent_account || undefined,
        bic: data.organization.bic || undefined,
        bank_name: data.organization.bank_name || undefined,
      }
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
        // More detailed error message
        const message = Array.isArray(er.detail) 
          ? er.detail.map((d: any) => `${d.loc.join(' -> ')} - ${d.msg}`).join('; ') 
          : er.detail || 'Ошибка регистрации';
        throw new Error(message);
      }

      router.push('/request');
    } catch (e: any) {
      addNotification({ title: 'Ошибка', message: e.message || 'Ошибка регистрации. Попробуйте снова.', type: 'error' });
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
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

  const fetchPartySuggest = useCallback(async (q: string) => {
    dadataAbort.current?.abort();
    dadataAbort.current = new AbortController();
    setDadataLoading(true);
    try {
      const url = `${API_BASE_URL}/api/v1/suggest/party?q=${encodeURIComponent(q)}&count=5`;
      const r = await fetch(url, { credentials: 'include', signal: dadataAbort.current.signal });
      if (!r.ok) return [];
      const data = await r.json();
      return (data?.suggestions ?? []) as DaDataParty[];
    } catch {
      return [];
    } finally {
      setDadataLoading(false);
    }
  }, []);
  
  const fetchAddrSuggest = useCallback(async (q: string) => {
    addrAbort.current?.abort();
    addrAbort.current = new AbortController();
    setAddrLoading(true);
    try {
        const url = `${API_BASE_URL}/api/v1/suggest/address?q=${encodeURIComponent(q)}&count=5`;
        const r = await fetch(url, { credentials: 'include', signal: addrAbort.current.signal });
        if (!r.ok) return [];
        const data = await r.json();
        return (data?.suggestions ?? []).map((s: any) => ({ value: s.value, unrestricted_value: s.unrestricted_value }));
    } catch {
        return [];
    } finally {
        setAddrLoading(false);
    }
}, []);

  useEffect(() => {
    const qParty = dadataQuery.trim();
    if (dadataFocus && qParty.length >= 2) {
      const t = setTimeout(() => fetchPartySuggest(qParty).then(setDadataSugg), 300);
      return () => clearTimeout(t);
    } else if (!dadataFocus) {
      setDadataSugg([]);
    }
  }, [dadataQuery, dadataFocus, fetchPartySuggest]);
  
  useEffect(() => {
    const q = addrQuery.trim();
    if (!addrFocus || q.length < 3) {
        if (!addrFocus) setAddrSugg([]);
        return;
    }
    const t = setTimeout(() => {
        fetchAddrSuggest(q).then(setAddrSugg);
    }, 300);
    return () => clearTimeout(t);
}, [addrQuery, addrFocus, fetchAddrSuggest]);

  const handlePickDadataParty = (party: DaDataParty) => {
    setValue('organization.company_name', party.value);
    setValue('organization.inn', party.inn);
    setValue('organization.ogrn', party.ogrn || '');
    setValue('organization.legal_address', party.legal_address || '');
    setValue('organization.director_name', '');
    setValue('organization.kpp', party.kpp || '');
    setValue('organization.okpo', party.okpo || '');
    setValue('organization.okato_oktmo', party.okato || '');
    setDadataQuery(party.value);
    setDadataSugg([]);
    setDadataFocus(false);
  };
  
  const onPickAddress = (val: string) => {
    setValue('organization.legal_address', val);
    setAddrQuery(val);
    setAddrSugg([]);
    setAddrFocus(false);
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

      <div>
        <label htmlFor="role" className={label}>Роль</label>
        <select id="role" {...register('role', { required: 'Роль обязательна' })} className={input}>
          <option value="Директор">Директор</option>
          <option value="РОП">РОП</option>
          <option value="Менеджер">Менеджер</option>
          <option value="Снабженец">Снабженец</option>
        </select>
        {errors.role && <p className={err}>{errors.role.message}</p>}
      </div>

      <div>
        <label htmlFor="employee_name" className={label}>Ваше ФИО</label>
        <input id="employee_name" type="text" {...register('employee_name', { required: 'ФИО обязательно' })} className={input} autoComplete="name" />
        {errors.employee_name && <p className={err}>{errors.employee_name.message}</p>}
      </div>

      <div>
        <label htmlFor="phone_number" className={label}>Ваш рабочий телефон</label>
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

      <div className="relative pt-4 border-t mt-4">
        <p className="font-medium text-gray-800 mb-2">Данные организации</p>
        <label htmlFor="organization" className={label}>Организация</label>
        <input
          id="organization"
          type="text"
          className={input}
          value={dadataQuery}
          onChange={(e) => setDadataQuery(e.target.value)}
          onFocus={() => setDadataFocus(true)}
          onBlur={() => setTimeout(() => setDadataFocus(false), 200)}
          placeholder="Введите ИНН или название организации"
          autoComplete="off"
        />
        {dadataLoading && <div className="text-xs text-gray-500 mt-1">Поиск...</div>}
        {dadataFocus && dadataSugg.length > 0 && (
          <div className="absolute z-40 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
            {dadataSugg.map((p, i) => (
              <button type="button" key={i} onMouseDown={() => handlePickDadataParty(p)} className="block w-full text-left px-3 py-2 hover:bg-amber-50 text-sm">
                <div className="font-semibold">{p.value}</div>
                <div className="text-xs text-gray-600">ИНН: {p.inn}, {p.legal_address}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="director_name" className={label}>ФИО директора</label>
        <input id="director_name" type="text" placeholder='Иванов Иван Иванович' {...register('organization.director_name', { required: 'ФИО обязательно' })} className={input} autoComplete="off" />
        {errors.organization?.director_name && <p className={err}>{errors.organization.director_name.message}</p>}
      </div>

      <div className='relative'>
        <label htmlFor="legal_address" className={label}>Юридический адрес</label>
        <input 
            id="legal_address" 
            type="text"
            placeholder='Начните вводить адрес...'
            {...register('organization.legal_address', { required: 'Юр. адрес обязателен' })} 
            className={input} 
            autoComplete="off"
            value={addrQuery}
            onChange={(e) => {
                setValue('organization.legal_address', e.target.value);
                setAddrQuery(e.target.value);
            }}
            onFocus={() => setAddrFocus(true)}
            onBlur={() => setTimeout(() => setAddrFocus(false), 200)}
         />
        {addrFocus && addrSugg.length > 0 && (
            <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-md shadow">
                {addrSugg.map((s, i) => (
                    <button
                        type="button"
                        key={i}
                        onMouseDown={() => onPickAddress(s.unrestricted_value || s.value)}
                        className="block w-full text-left px-3 py-2 hover:bg-amber-50"
                    >
                        {s.unrestricted_value || s.value}
                    </button>
                ))}
                {addrLoading && <div className="px-3 py-2 text-xs text-gray-500">Загрузка...</div>}
            </div>
        )}
        {errors.organization?.legal_address && <p className={err}>{errors.organization.legal_address.message}</p>}
      </div>

      <button type="submit" disabled={isLoading} className="w-full bg-amber-600 text-white py-2 px-4 rounded-md hover:bg-amber-700 disabled:opacity-50">
        {isLoading ? 'Регистрируем...' : 'Зарегистрироваться'}
      </button>
    </form>
  );
}
