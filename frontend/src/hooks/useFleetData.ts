import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import { POLL_INTERVAL_MS } from '../api/config';
import type {
  DroneStatus,
  NoFlyZone,
  Order,
  OrderLimits,
  RoutePlan,
  SimulationState,
} from '../api/types';

export interface FleetData {
  drones: DroneStatus[];
  orders: Order[];
  plan: RoutePlan | null;
  zones: NoFlyZone[];
  simulation: SimulationState | null;
  limits: OrderLimits | null;
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
  refresh: () => Promise<void>;
}

export function useFleetData(): FleetData {
  const [drones, setDrones] = useState<DroneStatus[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [zones, setZones] = useState<NoFlyZone[]>([]);
  const [simulation, setSimulation] = useState<SimulationState | null>(null);
  const [limits, setLimits] = useState<OrderLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const active = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [
        droneStatus,
        orderList,
        routePlan,
        zoneList,
        simulationState,
        limitsData,
      ] = await Promise.all([
        api.getDroneStatus(),
        api.getOrders(),
        api.getRoutePlan(),
        api.getZones(),
        api.getSimulation(),
        api.getLimits(),
      ]);
      if (!active.current) return;
      setDrones(droneStatus);
      setOrders(orderList);
      setPlan(routePlan);
      setZones(zoneList);
      setSimulation(simulationState);
      setLimits(limitsData);
      setError(null);
      setLastSync(new Date());
    } catch (err) {
      if (!active.current) return;
      setError(err instanceof ApiError ? err.message : 'Erro inesperado ao sincronizar.');
    } finally {
      if (active.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    active.current = true;
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      active.current = false;
      clearInterval(id);
    };
  }, [refresh]);

  return {
    drones,
    orders,
    plan,
    zones,
    simulation,
    limits,
    loading,
    error,
    lastSync,
    refresh,
  };
}
