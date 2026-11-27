export interface Tag {
  id: string;
  name: string;
  emoji: string;
  /** Offer the "+service charge" chip when this tag is selected */
  serviceCharge: boolean;
  order: number;
}

export interface Txn {
  id: string;
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  note: string;
  tagIds: string[];
  /** What you typed: your portion, before service charge */
  baseAmount: number;
  serviceCharge: boolean;
  /** Rate (%) used when the record was saved, so changing the setting never rewrites history */
  serviceRate: number;
  /** Final value = baseAmount, or baseAmount + service charge */
  amount: number;
  /** Someone else paid for it */
  covered: boolean;
  coveredBy: string;
  createdAt: number;
  updatedAt: number;
}

export type Theme = 'light' | 'dark' | 'system';
export const THEMES: Theme[] = ['light', 'dark', 'system'];

export interface Settings {
  currency: string;
  serviceRate: number;
  theme: Theme;
}

export const DEFAULT_SETTINGS: Settings = { currency: 'Rs', serviceRate: 10, theme: 'light' };
