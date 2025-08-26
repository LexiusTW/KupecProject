
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

  // --- поля только для продавца:
  phone_number?: string;   // номер телефона ответственного лица
  director_name?: string;  // ФИО директора
  legal_address?: string;  // юридический адрес
  inn?: string;            // ИНН
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