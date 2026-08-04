import type { Coordinate, NoFlyZone } from './types';

export const BASE: Coordinate = { x: 0, y: 0 };

export function distance(a: Coordinate, b: Coordinate): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isInsideZone(p: Coordinate, zone: NoFlyZone): boolean {
  return (
    p.x >= zone.minX && p.x <= zone.maxX && p.y >= zone.minY && p.y <= zone.maxY
  );
}

export function zoneAt(p: Coordinate, zones: NoFlyZone[]): NoFlyZone | null {
  return zones.find((z) => isInsideZone(p, z)) ?? null;
}

export function straightRoundTripKm(p: Coordinate): number {
  return distance(BASE, p) * 2;
}
