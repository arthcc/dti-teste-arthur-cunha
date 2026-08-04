import { useEffect, useRef } from 'react';
import { trackOrder, type TrackingStage } from '../api/tracking';
import type { DroneStatus, Order, RoutePlan } from '../api/types';
import { useToast } from '../components/Toast';

interface Snapshot {
  stage: TrackingStage;
  blocksAway: number | null;
}

const TITLE: Partial<Record<TrackingStage, string>> = {
  loading: 'Pedido em separação',
  enroute: 'Pedido a caminho',
  arriving: 'Pedido chegando',
  delivered: 'Pedido entregue',
  unassigned: 'Pedido sem drone disponível',
};

export function useDeliveryAlerts(
  orders: Order[],
  drones: DroneStatus[],
  plan: RoutePlan | null,
): void {
  const toast = useToast();
  const previous = useRef(new Map<string, Snapshot>());
  const seeded = useRef(false);

  useEffect(() => {
    if (orders.length === 0 && !seeded.current) return;

    const current = new Map<string, Snapshot>();

    for (const order of orders) {
      const tracking = trackOrder(order, drones, plan);
      const snapshot: Snapshot = {
        stage: tracking.stage,
        blocksAway: tracking.blocksAway,
      };
      current.set(order.id, snapshot);

      if (!seeded.current) continue;

      const before = previous.current.get(order.id);
      if (before?.stage === tracking.stage) continue;

      const title = TITLE[tracking.stage];
      if (!title) continue;

      toast.push(title, {
        detail: `(${order.location.x}, ${order.location.y}) · ${tracking.message}`,
        tone: tracking.stage === 'unassigned' ? 'error' : 'ok',
      });
    }

    previous.current = current;
    seeded.current = true;
  }, [orders, drones, plan, toast]);
}
