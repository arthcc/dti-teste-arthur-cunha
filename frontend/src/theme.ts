import type { Priority } from './api/types';

export const C = {
  paper: '#ffffff',
  field: '#e9ecee',
  inset: '#f4f6f7',
  ink: '#14181b',
  ink2: '#4d565b',
  ink3: '#868f95',
  ink4: '#b4babe',
  rule: '#dde0e2',
  rule2: '#c4c9cc',
  hair: '#eceff1',
  pen: '#1d3fbf',
  penSoft: '#aab7e6',
  alert: '#c0271a',
  alertWash: '#fbeeed',
} as const;

export const PRIORITY_HEX: Record<Priority, string> = {
  alta: '#b3241a',
  media: '#a8751f',
  baixa: '#6f7a80',
};

export const PRIORITY_MARK: Record<Priority, { r: number; hollow: boolean }> = {
  alta: { r: 5, hollow: false },
  media: { r: 4.2, hollow: false },
  baixa: { r: 3.6, hollow: true },
};

export const PRIORITY_BAR_FILL: Record<Priority, string> = {
  alta: '#b3241a',
  media: '#a8751f',
  baixa: '#dde2e4',
};
