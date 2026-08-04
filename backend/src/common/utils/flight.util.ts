import {
  HOVER_DRAIN_PER_MINUTE,
  LOADING_MINUTES,
  SERVICE_MINUTES_PER_STOP,
} from '../config/simulation.config';

export interface FlightCost {
  flightMinutes: number;
  serviceMinutes: number;
  loadingMinutes: number;
  totalMinutes: number;
  batteryPercent: number;
}

export function batteryPercentPerKm(rangeKm: number): number {
  return rangeKm > 0 ? 100 / rangeKm : Infinity;
}

export function flightMinutes(distanceKm: number, speedKmh: number): number {
  if (speedKmh <= 0) return Infinity;
  return (distanceKm / speedKmh) * 60;
}

export function estimateFlight(
  distanceKm: number,
  stops: number,
  drone: { rangeKm: number; speedKmh: number },
): FlightCost {
  const flight = flightMinutes(distanceKm, drone.speedKmh);
  const service = stops * SERVICE_MINUTES_PER_STOP;
  const loading = stops > 0 ? LOADING_MINUTES : 0;
  const groundMinutes = service + loading;

  return {
    flightMinutes: flight,
    serviceMinutes: service,
    loadingMinutes: loading,
    totalMinutes: flight + groundMinutes,
    batteryPercent:
      distanceKm * batteryPercentPerKm(drone.rangeKm) +
      groundMinutes * HOVER_DRAIN_PER_MINUTE,
  };
}

export function clampBattery(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return `${total}min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
