import type {
  CreateDroneInput,
  CreateOrderInput,
  CreateZoneInput,
  Drone,
  DroneStatus,
  NoFlyZone,
  Order,
  OrderLimits,
  RoutePlan,
  SimulationState,
} from './types';

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:3000';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError('Sem conexão com a API. Verifique se o backend está no ar.', 0);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message)
      ? body.message.join(' · ')
      : body?.message ?? `Falha na requisição (${res.status})`;
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const api = {
  baseUrl: BASE_URL,

  getDrones: () => request<Drone[]>('/drones'),
  getDroneStatus: () => request<DroneStatus[]>('/drones/status'),
  createDrone: (input: CreateDroneInput) => post<Drone>('/drones', input),

  getOrders: () => request<Order[]>('/pedidos'),
  createOrder: (input: CreateOrderInput) => post<Order>('/pedidos', input),
  getLimits: () => request<OrderLimits>('/pedidos/limites'),

  getZones: () => request<NoFlyZone[]>('/zonas'),
  createZone: (input: CreateZoneInput) => post<NoFlyZone>('/zonas', input),
  deleteZone: (id: string) =>
    request<void>(`/zonas/${id}`, { method: 'DELETE' }),

  getRoutePlan: () => request<RoutePlan>('/entregas/rota'),

  getSimulation: () => request<SimulationState>('/entregas/simulacao'),
  pauseSimulation: () => post<SimulationState>('/entregas/simulacao/pausar'),
  resumeSimulation: () => post<SimulationState>('/entregas/simulacao/retomar'),
  resetSimulation: () => post<SimulationState>('/entregas/simulacao/reiniciar'),
};
