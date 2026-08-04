import { formatMinutes, PRIORITY_RANK } from './config';
import type { Coordinate, DroneStatus, Order, RoutePlan } from './types';

export function sortDeliveryQueue(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const doneA = a.status === 'delivered' ? 1 : 0;
    const doneB = b.status === 'delivered' ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    const p = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (p !== 0) return p;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function queuePosition(orders: Order[]): Map<string, number> {
  return new Map(sortDeliveryQueue(orders).map((o, i) => [o.id, i + 1]));
}

export type TrackingStage =
  | 'queued'
  | 'unassigned'
  | 'loading'
  | 'enroute'
  | 'arriving'
  | 'delivered';

export interface Tracking {
  stage: TrackingStage;
  message: string;
  blocksAway: number | null;
  droneId: string | null;
  droneName: string | null;
  etaMinutes: number | null;
  reason: string | null;
}

const STAGE_LABEL: Record<TrackingStage, string> = {
  queued: 'Na fila',
  unassigned: 'Sem alocação',
  loading: 'Separando',
  enroute: 'A caminho',
  arriving: 'Chegando',
  delivered: 'Entregue',
};

export function stageLabel(stage: TrackingStage): string {
  return STAGE_LABEL[stage];
}

export function blocksBetween(a: Coordinate, b: Coordinate): number {
  return Math.round(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)));
}

function blocksLabel(n: number): string {
  return n === 1 ? '1 quadra' : `${n} quadras`;
}

const EMPTY = {
  blocksAway: null,
  droneId: null,
  droneName: null,
  etaMinutes: null,
  reason: null,
};

export function trackOrder(
  order: Order,
  drones: DroneStatus[],
  plan: RoutePlan | null,
): Tracking {
  if (order.status === 'delivered') {
    return {
      ...EMPTY,
      stage: 'delivered',
      message:
        order.deliveryMinutes === null
          ? 'Entregue.'
          : `Entregue em ${formatMinutes(order.deliveryMinutes)} de voo.`,
      droneId: order.assignedDroneId,
    };
  }

  const drone = order.assignedDroneId
    ? (drones.find((d) => d.id === order.assignedDroneId) ?? null)
    : null;

  if (drone) {
    if (drone.state === 'loading') {
      return {
        ...EMPTY,
        stage: 'loading',
        message: `Seu pacote está sendo carregado no ${drone.name}, na base.`,
        droneId: drone.id,
        droneName: drone.name,
      };
    }

    const blocks = blocksBetween(drone.position, order.location);

    if (blocks === 0) {
      return {
        ...EMPTY,
        stage: 'arriving',
        message: 'Seu pacote está chegando agora.',
        blocksAway: 0,
        droneId: drone.id,
        droneName: drone.name,
      };
    }

    return {
      ...EMPTY,
      stage: blocks <= 2 ? 'arriving' : 'enroute',
      message: `Seu pacote está a ${blocksLabel(blocks)} de distância.`,
      blocksAway: blocks,
      droneId: drone.id,
      droneName: drone.name,
    };
  }

  const rejection = plan?.unassigned.find((u) => u.order.id === order.id);
  if (rejection) {
    return {
      ...EMPTY,
      stage: 'unassigned',
      message: rejection.reason,
      reason: rejection.reason,
    };
  }

  const trip = plan?.trips.find((t) => t.orders.some((o) => o.id === order.id));
  if (trip) {
    return {
      ...EMPTY,
      stage: 'queued',
      message: `Sai na próxima janela com o ${trip.droneName} · previsão de ${formatMinutes(
        trip.totalMinutes,
      )}.`,
      droneId: trip.droneId,
      droneName: trip.droneName,
      etaMinutes: trip.totalMinutes,
    };
  }

  return {
    ...EMPTY,
    stage: 'queued',
    message: 'Na fila, aguardando o próximo drone livre.',
  };
}
