export interface SearchFormData {
  supplier?: string;
  category?: string;
  grade?: string; // Corresponds to 'stamp' in API
  standard?: string; // Corresponds to 'gost' in API
  city?: string;
  thickness?: string;
  length?: string;
  width?: string;
  diameter?: string;
}

export type Product = {
  name: string;
  category: string;
  material: string | null;
  stamp: string; // Replaces 'brand'
  city: string; // Replaces 'country'
  gost: string;
  diameter: number;
  thickness: number;
  width: number;
  length: number;
  supplier: string;
  price: number | null;
};


export interface ResultItem {
  id: number;
  name: string;
  category: string;
  stamp: string;
  gost: string;
  city: string;
  thickness: string | null;
  length: string | null;
  width: string | null;
  diameter: string | null;
  price: number | null;
  supplier: string;
  material: string | null;
}
