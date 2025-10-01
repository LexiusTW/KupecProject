'use client';

import { useRef, useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import type { RegisterFormData, DaDataParty, DaDataAddr } from './types';
import Notification, { NotificationProps } from './Notification';

const API_BASE_URL = 'https://kupecbek.cloudpub.ru';

export default function RegisterForm() {
  const [notifications, setNotifications] = useState<Omit<NotificationProps, 'onDismiss'>[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const submittingRef = useRef(false);
  const router = useRouter();

  const { register, handleSubmit, formState: { errors }, control, setValue, watch } = useForm<RegisterFormData>({
    defaultValues: {
      phone_number: '',
      login: '',
      password: '',
      email: '',
      role: 'Менеджер',
      employee_name: '',
      director_name: '',
      legal_address: '',
    },
  });

  const addNotification = (notif: Omit<NotificationProps, 'id' | 'onDismiss'>) => {
    const id = new Date().toISOString();
    setNotifications(prev => [...prev, { ...notif, id }]);
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // DaData states for party (organization)
  const [dadataQuery, setDadataQuery] = useState('');
  const [dadataSugg, setDadataSugg] = useState<DaDataParty[]>([]);
  const [dadataFocus, setDadataFocus] = useState(false);
  const [dadataLoading, setDadataLoading] = useState(false);
  const dadataAbort = useRef<AbortController | null>(null);

  // DaData states for address
  const [addrQuery, setAddrQuery] = useState('');
  const [addrSugg, setAddrSugg] = useState<DaDataAddr[]>([]);
  const [addrFocus, setAddrFocus] = useState(false);
  const [addrLoading, setAddrLoading] = useState(false);
  const addrAbort = useRef<AbortController | null>(null);
  
  const legalAddressValue = watch('legal_address');

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
      phone_number: data.phone_number?.replace(/\D/g, ''), // Отправляем только цифры
      director_name: data.director_name,
      legal_address: data.legal_address,
      inn: data.organization?.inn,
      ogrn: data.organization?.ogrn,
      kpp: data.organization?.kpp,
      okpo: data.organization?.okpo,
      okato_oktmo: data.organization?.okato,
      company_name: data.organization?.value,
      bank_account: undefined,
      correspondent_account: undefined,
      bic: undefined,
      bank_name: undefined,
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
      addNotification({ title: 'Ошибка', message: e.message || 'Ошибка регистрации. Попробуйте снова.', type: 'error' });
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
    }
  };

  const handlePhoneNumberChange = (e: ChangeEvent<HTMLInputElement>, field: any) => {
    const input = e.target;
    let digits = input.value.replace(/\D/g, '');
    const matrix = "+7 (___) ___-__-__";

    if (digits.length > 0) {
      if (digits.startsWith('8')) digits = '7' + digits.slice(1);
      if (!digits.startsWith('7')) digits = '7' + digits;
    }

    let i = 0;
    let formattedValue = matrix.replace(/./g, (char) => {
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
    setValue('organization', party);
    setValue('legal_address', party.legal_address || '');
    setValue('director_name', ' '); // dadata doesn't provide director name in suggestions
    setDadataQuery(party.short_name || party.value || '');
    setDadataSugg([]);
    setDadataFocus(false);
  };
  
  const onPickAddress = (val: string) => {
    setValue('legal_address', val);
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
        <label htmlFor="employee_name" className={label}>ФИО сотрудника</label>
        <input id="employee_name" type="text" {...register('employee_name', { required: 'ФИО сотрудника обязательно' })} className={input} autoComplete="name" />
        {errors.employee_name && <p className={err}>{errors.employee_name.message}</p>}
      </div>

      <div>
        <label htmlFor="phone_number" className={label}>Телефон ответственного</label>
        <Controller
          name="phone_number"
          control={control}
          rules={{ required: 'Номер обязателен' }}
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
        {errors.phone_number && <p className={err}>{errors.phone_number.message}</p>}
      </div>

      <div className="relative">
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
                <div className="font-semibold">{p.short_name || p.value}</div>
                <div className="text-xs text-gray-600">ИНН: {p.inn}, {p.legal_address}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <input type="hidden" {...register('organization')} />

      <div>
        <label htmlFor="director_name" className={label}>ФИО директора</label>
        <input id="director_name" type="text" placeholder='Иванов Иван Иванович' {...register('director_name', { required: 'ФИО обязательно' })} className={input} autoComplete="off" />
        {errors.director_name && <p className={err}>{errors.director_name.message}</p>}
      </div>

      <div className='relative'>
        <label htmlFor="legal_address" className={label}>Юридический адрес</label>
        <input 
            id="legal_address" 
            type="text"
            placeholder='Начните вводить адрес...'
            {...register('legal_address', { required: 'Юр. адрес обязателен' })} 
            className={input} 
            autoComplete="off"
            value={addrQuery}
            onChange={(e) => {
                setValue('legal_address', e.target.value);
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
        {errors.legal_address && <p className={err}>{errors.legal_address.message}</p>}
      </div>

      

      <button type="submit" disabled={isLoading} className="w-full bg-amber-600 text-white py-2 px-4 rounded-md hover:bg-amber-700 disabled:opacity-50">
        {isLoading ? 'Регистрируем...' : 'Зарегистрироваться'}
      </button>
    </form>
  );
}