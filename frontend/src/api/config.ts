import type { DroneState, OrderStatus, Priority } from './types';

export const GRID_SIZE = 20;

export const POLL_INTERVAL_MS = 1500;

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  high: 'var(--prio-high)',
  medium: 'var(--prio-medium)',
  low: 'var(--prio-low)',
};

export const PRIORITY_RANK: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export const DRONE_STATE_LABEL: Record<DroneState, string> = {
  idle: 'Em espera',
  loading: 'Carregando',
  in_flight: 'Em voo',
  delivering: 'Entregando',
  returning: 'Retornando',
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Na fila',
  allocated: 'Alocado',
  in_transit: 'A bordo',
  delivered: 'Entregue',
};

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 1) return `${minutes.toFixed(1).replace('.', ',')}min`;
  const total = Math.round(minutes);
  if (total < 60) return `${total}min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
