import { Test, TestingModule } from '@nestjs/testing';
import { TICK_MS } from '../common/config/simulation.config';
import { Priority } from '../common/enums/priority.enum';
import { Rect } from '../common/interfaces/rect.interface';
import { DeliveriesService } from '../modules/deliveries/deliveries.service';
import { SimulationService } from '../modules/deliveries/simulation.service';
import { DronesService } from '../modules/drones/drones.service';
import { Drone } from '../modules/drones/interfaces/drone.interface';
import { OrdersService } from '../modules/orders/orders.service';
import { Order } from '../modules/orders/interfaces/order.interface';
import { NoFlyZone } from '../modules/zones/interfaces/zone.interface';
import { ZonesService } from '../modules/zones/zones.service';

export interface DomainContext {
  moduleRef: TestingModule;
  drones: DronesService;
  zones: ZonesService;
  orders: OrdersService;
  deliveries: DeliveriesService;
}

export interface SimulationContext extends DomainContext {
  simulation: SimulationService;
}

export async function createDomainContext(): Promise<DomainContext> {
  const moduleRef = await Test.createTestingModule({
    providers: [DronesService, ZonesService, OrdersService, DeliveriesService],
  }).compile();

  return {
    moduleRef,
    drones: moduleRef.get(DronesService),
    zones: moduleRef.get(ZonesService),
    orders: moduleRef.get(OrdersService),
    deliveries: moduleRef.get(DeliveriesService),
  };
}

export async function createSimulationContext(): Promise<SimulationContext> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      DronesService,
      ZonesService,
      OrdersService,
      DeliveriesService,
      SimulationService,
    ],
  }).compile();

  await moduleRef.init();

  return {
    moduleRef,
    drones: moduleRef.get(DronesService),
    zones: moduleRef.get(ZonesService),
    orders: moduleRef.get(OrdersService),
    deliveries: moduleRef.get(DeliveriesService),
    simulation: moduleRef.get(SimulationService),
  };
}

export interface DroneSpec {
  name?: string;
  capacityKg?: number;
  rangeKm?: number;
  speedKmh?: number;
}

export function addDrone(ctx: DomainContext, spec: DroneSpec = {}): Drone {
  return ctx.drones.create({
    name: spec.name,
    capacityKg: spec.capacityKg ?? 10,
    rangeKm: spec.rangeKm ?? 60,
    speedKmh: spec.speedKmh ?? 40,
  });
}

export interface OrderSpec {
  x: number;
  y: number;
  weightKg?: number;
  priority?: Priority;
}

export function addOrder(ctx: DomainContext, spec: OrderSpec): Order {
  return ctx.orders.create({
    location: { x: spec.x, y: spec.y },
    weightKg: spec.weightKg ?? 1,
    priority: spec.priority ?? Priority.MEDIA,
  });
}

export function addZone(
  ctx: DomainContext,
  rect: Rect,
  name?: string,
): NoFlyZone {
  return ctx.zones.create({ ...rect, name });
}

export function encircle(x: number, y: number): Rect[] {
  return [
    { minX: x - 1, maxX: x + 1, minY: y - 1, maxY: y - 1 },
    { minX: x - 1, maxX: x + 1, minY: y + 1, maxY: y + 1 },
    { minX: x - 1, maxX: x - 1, minY: y, maxY: y },
    { minX: x + 1, maxX: x + 1, minY: y, maxY: y },
  ];
}

export function advanceTicks(
  count: number,
  onTick?: (index: number) => void,
): void {
  for (let index = 0; index < count; index += 1) {
    jest.advanceTimersByTime(TICK_MS);
    onTick?.(index);
  }
}

export function runUntil(
  done: () => boolean,
  maxTicks: number,
  onTick?: (index: number) => void,
): number {
  for (let index = 0; index < maxTicks; index += 1) {
    if (done()) return index;
    jest.advanceTimersByTime(TICK_MS);
    onTick?.(index);
  }
  return maxTicks;
}

export function pseudoRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
