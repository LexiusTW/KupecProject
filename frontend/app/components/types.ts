
// Роль пользователя при регистрации
export type Role = 'buyer' | 'seller';

// Данные формы авторизации (логин)
export interface AuthFormData {
  login: string;
  password: string;
}

/**
 * Данные формы регистрации (общий тип для покупателя и продавца).
 * Для покупателя нужны только login и password.
 * Для продавца добавляются поля ниже — они опциональны,
 * чтобы тип подходил для обеих вкладок одной формы.
 */
export interface RegisterFormData {
  login: string;
  password: string;
  email: string;
  role: string;
  employee_name: string;
  phone_number?: string;
  organization: OrganizationFormData;
}

export interface OrganizationFormData {
  company_name: string;
  inn: string;
  ogrn: string;
  legal_address: string;
  director_name: string;
  kpp?: string;
  okpo?: string;
  okato_oktmo?: string;
  bank_account?: string;
  correspondent_account?: string;
  bic?: string;
  bank_name?: string;
}

export interface Product {
  id: number;
  category: string;
  name: string;
  material: string;
  gost: string;
  dimensions: string;
  weight_per_meter?: number;
  price_per_ton: number;
  availability: number;
  supplier: string;
  created_at: string;
  updated_at: string;
}

export type RequestItem = {
  category?: string;
  stamp?: string;
  state_standard?: string; // ГОСТ
  city?: string;
  thickness?: number | null;
  length?: number | null;
  width?: number | null;
  diameter?: number | null;
};

export type RequestCreate = {
  items: RequestItem[];
  comment?: string;
};

export type BuyerProfile = {
  delivery_address?: string | null;
};

// Типы для подсказок DaData
export type DaDataParty = {
  value: string;
  unrestricted_value: string;
  inn: string;
  kpp?: string;
  ogrn?: string;
  okpo?: string;
  okato?: string;
  short_name?: string;
  legal_address?: string;
};

export type DaDataAddr = {
  value: string;
  unrestricted_value?: string;
};