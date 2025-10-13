export type UserRole = 'Директор' | 'РОП' | 'Менеджер' | 'Снабженец';

export interface Organization {
  id: number;
  company_name: string;
}

export interface CurrentUser {
  id: number;
  login: string;
  role: UserRole;
  organization: Organization;
}

export interface User extends CurrentUser {
  employee_name: string;
  email: string;
  phone_number: string | null;
  created_at: string;
  is_active: boolean;
  parent_id: number | null;
}
