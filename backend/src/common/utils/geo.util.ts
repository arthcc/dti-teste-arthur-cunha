import { GRID_SIZE } from '../config/simulation.config';
import { Coordinate } from '../interfaces/coordinate.interface';
import { Rect } from '../interfaces/rect.interface';

export const BASE: Coordinate = { x: 0, y: 0 };

export function distance(a: Coordinate, b: Coordinate): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isInside(p: Coordinate, rect: Rect): boolean {
  return (
    p.x >= rect.minX && p.x <= rect.maxX && p.y >= rect.minY && p.y <= rect.maxY
  );
}

export function isBlocked(p: Coordinate, zones: Rect[]): boolean {
  return zones.some((z) => isInside(p, z));
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x <= GRID_SIZE && y >= 0 && y <= GRID_SIZE;
}

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const key = (x: number, y: number): number => y * (GRID_SIZE + 1) + x;

function blockedMask(zones: Rect[]): Uint8Array {
  const mask = new Uint8Array((GRID_SIZE + 1) * (GRID_SIZE + 1));
  for (const zone of zones) {
    const x0 = Math.max(0, Math.ceil(zone.minX));
    const x1 = Math.min(GRID_SIZE, Math.floor(zone.maxX));
    const y0 = Math.max(0, Math.ceil(zone.minY));
    const y1 = Math.min(GRID_SIZE, Math.floor(zone.maxY));
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) mask[key(x, y)] = 1;
    }
  }
  return mask;
}

export function findPath(
  from: Coordinate,
  to: Coordinate,
  zones: Rect[] = [],
): Coordinate[] | null {
  if (!inBounds(from.x, from.y) || !inBounds(to.x, to.y)) return null;
  if (isBlocked(from, zones) || isBlocked(to, zones)) return null;
  if (from.x === to.x && from.y === to.y) return [{ ...from }];

  const size = (GRID_SIZE + 1) * (GRID_SIZE + 1);
  const gScore = new Float64Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const blocked = blockedMask(zones);

  const heuristic = (x: number, y: number): number => {
    const dx = Math.abs(x - to.x);
    const dy = Math.abs(y - to.y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };

  const start = key(from.x, from.y);
  const goal = key(to.x, to.y);
  gScore[start] = 0;

  const open: Array<{ node: number; f: number }> = [
    { node: start, f: heuristic(from.x, from.y) },
  ];

  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0].node;

    if (current === goal) {
      const path: Coordinate[] = [];
      for (let node = goal; node !== -1; node = cameFrom[node]) {
        path.push({
          x: node % (GRID_SIZE + 1),
          y: Math.floor(node / (GRID_SIZE + 1)),
        });
      }
      return path.reverse();
    }

    if (closed[current]) continue;
    closed[current] = 1;

    const cx = current % (GRID_SIZE + 1);
    const cy = Math.floor(current / (GRID_SIZE + 1));

    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny)) continue;

      const nKey = key(nx, ny);
      if (blocked[nKey] || closed[nKey]) continue;

      if (dx !== 0 && dy !== 0) {
        if (blocked[key(cx + dx, cy)] && blocked[key(cx, cy + dy)]) continue;
      }

      const step = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
      const tentative = gScore[current] + step;
      if (tentative < gScore[nKey]) {
        gScore[nKey] = tentative;
        cameFrom[nKey] = current;
        open.push({ node: nKey, f: tentative + heuristic(nx, ny) });
      }
    }
  }

  return null;
}

export function simplifyPath(path: Coordinate[]): Coordinate[] {
  if (path.length <= 2) return [...path];

  const out: Coordinate[] = [path[0]];
  for (let i = 1; i < path.length - 1; i += 1) {
    const prev = out[out.length - 1];
    const curr = path[i];
    const next = path[i + 1];
    const cross =
      (curr.x - prev.x) * (next.y - prev.y) -
      (curr.y - prev.y) * (next.x - prev.x);
    if (cross !== 0) out.push(curr);
  }
  out.push(path[path.length - 1]);
  return out;
}

export function pathDistance(path: Coordinate[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    total += distance(path[i - 1], path[i]);
  }
  return total;
}

export interface Leg {
  from: Coordinate;
  to: Coordinate;
  path: Coordinate[];
  distanceKm: number;
}

export function buildLeg(
  from: Coordinate,
  to: Coordinate,
  zones: Rect[] = [],
): Leg | null {
  const raw = findPath(from, to, zones);
  if (!raw) return null;
  return {
    from: { ...from },
    to: { ...to },
    path: simplifyPath(raw),
    distanceKm: pathDistance(raw),
  };
}

export function travelDistance(
  a: Coordinate,
  b: Coordinate,
  zones: Rect[] = [],
): number {
  if (zones.length === 0) return distance(a, b);
  const path = findPath(a, b, zones);
  return path ? pathDistance(path) : Infinity;
}

export function sortByNearestNeighbor(
  points: Coordinate[],
  zones: Rect[] = [],
  origin: Coordinate = BASE,
): Coordinate[] {
  const remaining = [...points];
  const route: Coordinate[] = [];
  let current = origin;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let shortest = Infinity;
    remaining.forEach((p, i) => {
      const d = travelDistance(current, p, zones);
      if (d < shortest) {
        shortest = d;
        nearestIdx = i;
      }
    });
    current = remaining.splice(nearestIdx, 1)[0];
    route.push(current);
  }

  return route;
}

export interface RouteShape {
  stops: Coordinate[];
  path: Coordinate[];
  distanceKm: number;
  legs: Leg[];
}

export function buildRoute(
  stops: Coordinate[],
  zones: Rect[] = [],
  base: Coordinate = BASE,
): RouteShape | null {
  const legs: Leg[] = [];
  const path: Coordinate[] = [{ ...base }];
  let current = base;
  let distanceKm = 0;

  for (const stop of [...stops, base]) {
    const leg = buildLeg(current, stop, zones);
    if (!leg) return null;
    legs.push(leg);
    path.push(...leg.path.slice(1));
    distanceKm += leg.distanceKm;
    current = stop;
  }

  return { stops: [...stops], path, distanceKm, legs };
}

export function routeDistance(
  points: Coordinate[],
  zones: Rect[] = [],
  base: Coordinate = BASE,
): number {
  if (points.length === 0) return 0;

  let total = 0;
  let current = base;
  for (const p of points) {
    const d = travelDistance(current, p, zones);
    if (!Number.isFinite(d)) return Infinity;
    total += d;
    current = p;
  }
  const back = travelDistance(current, base, zones);
  return Number.isFinite(back) ? total + back : Infinity;
}

export function pointAlongPath(
  path: Coordinate[],
  travelled: number,
): Coordinate {
  if (path.length === 0) return { ...BASE };
  if (travelled <= 0) return { ...path[0] };

  let remaining = travelled;
  for (let i = 1; i < path.length; i += 1) {
    const segment = distance(path[i - 1], path[i]);
    if (segment === 0) continue;
    if (remaining <= segment) {
      const t = remaining / segment;
      return {
        x: path[i - 1].x + (path[i].x - path[i - 1].x) * t,
        y: path[i - 1].y + (path[i].y - path[i - 1].y) * t,
      };
    }
    remaining -= segment;
  }

  return { ...path[path.length - 1] };
}
