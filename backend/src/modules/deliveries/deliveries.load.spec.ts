import { BATTERY_RESERVE_PERCENT } from '../../common/config/simulation.config';
import { Priority } from '../../common/enums/priority.enum';
import {
  DomainContext,
  SimulationContext,
  addDrone,
  addOrder,
  createDomainContext,
  createSimulationContext,
  pseudoRandom,
  runUntil,
} from '../../testing/test-context';
import { Order, OrderStatus } from '../orders/interfaces/order.interface';
import { AllocationPlan } from './interfaces/trip.interface';

const PRIORIDADES = [Priority.BAIXA, Priority.MEDIA, Priority.ALTA];

function seedOrders(ctx: DomainContext, total: number, seed = 42): Order[] {
  const random = pseudoRandom(seed);
  const orders: Order[] = [];

  for (let i = 0; i < total; i += 1) {
    orders.push(
      addOrder(ctx, {
        x: 1 + Math.floor(random() * 8),
        y: 1 + Math.floor(random() * 8),
        weightKg: 1 + Math.floor(random() * 4),
        priority: PRIORIDADES[Math.floor(random() * 3)],
      }),
    );
  }

  return orders;
}

function fleetLoad(ctx: DomainContext): Map<string, number> {
  const load = new Map<string, number>();

  for (const order of ctx.orders.findAll()) {
    if (order.assignedDroneId === null) continue;
    if (order.status === OrderStatus.DELIVERED) continue;
    load.set(
      order.assignedDroneId,
      (load.get(order.assignedDroneId) ?? 0) + order.weightKg,
    );
  }

  return load;
}

function filaVazia(ctx: SimulationContext, total: number): () => boolean {
  return () => {
    const snapshot = ctx.simulation.snapshot();
    return snapshot.ordersDelivered === total && snapshot.activeFlights === 0;
  };
}

function expectFleetInvariants(ctx: DomainContext): void {
  const load = fleetLoad(ctx);

  for (const drone of ctx.drones.findAll()) {
    expect(load.get(drone.id) ?? 0).toBeLessThanOrEqual(drone.capacityKg);
    expect(drone.batteryPercent).toBeGreaterThanOrEqual(0);
    expect(drone.batteryPercent).toBeLessThanOrEqual(100);
  }
}

function expectSingleAssignment(ctx: DomainContext): void {
  for (const [droneId] of fleetLoad(ctx)) {
    expect(ctx.drones.findById(droneId).currentTripId).not.toBeNull();
  }
}

function expectPlanIsSound(ctx: DomainContext, plan: AllocationPlan): void {
  const alocados = plan.trips.flatMap((t) => t.orders.map((o) => o.id));
  const recusados = plan.unassigned.map((u) => u.order.id);
  const droneIds = plan.trips.map((t) => t.drone.id);

  expect(new Set(alocados).size).toBe(alocados.length);
  expect(new Set(droneIds).size).toBe(droneIds.length);
  expect(new Set([...alocados, ...recusados])).toEqual(
    new Set(ctx.orders.findAll().map((o) => o.id)),
  );
  expect(alocados.length + recusados.length).toBe(
    ctx.orders.findAll().length,
  );

  for (const trip of plan.trips) {
    expect(trip.orders.length).toBeGreaterThan(0);
    expect(trip.totalWeightKg).toBeLessThanOrEqual(trip.drone.capacityKg);
    expect(trip.totalDistanceKm).toBeLessThanOrEqual(trip.drone.rangeKm);
    expect(trip.batteryAfterPercent).toBeGreaterThanOrEqual(
      BATTERY_RESERVE_PERCENT,
    );
  }

  for (const item of plan.unassigned) {
    expect(item.reason.length).toBeGreaterThan(0);
  }
}

function inParallel(
  ctx: DomainContext,
  total: number,
  offset = 0,
): Promise<Order[]> {
  return Promise.all(
    Array.from({ length: total }, (_, i) =>
      Promise.resolve().then(() =>
        addOrder(ctx, {
          x: 1 + ((offset + i) % 9),
          y: 1 + ((offset + i * 3) % 9),
          weightKg: 1 + ((offset + i) % 4),
          priority: PRIORIDADES[(offset + i) % 3],
        }),
      ),
    ),
  );
}

describe('carga: planejamento com muitos pedidos simultâneos', () => {
  let ctx: DomainContext;

  beforeEach(async () => {
    ctx = await createDomainContext();
    for (let i = 0; i < 6; i += 1) {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60, speedKmh: 40 });
    }
  });

  it('não perde nem duplica nenhum pedido entre viagens e recusas', () => {
    const orders = seedOrders(ctx, 60);

    const plan = ctx.deliveries.plan();
    const alocados = plan.trips.flatMap((t) => t.orders.map((o) => o.id));
    const recusados = plan.unassigned.map((u) => u.order.id);

    expect(new Set(alocados).size).toBe(alocados.length);
    expect(new Set(recusados).size).toBe(recusados.length);
    expect(new Set([...alocados, ...recusados])).toEqual(
      new Set(orders.map((o) => o.id)),
    );
    expect(alocados.length + recusados.length).toBe(orders.length);
  });

  it('respeita capacidade, autonomia e reserva de bateria em todas as viagens', () => {
    seedOrders(ctx, 60);

    const plan = ctx.deliveries.plan();

    expect(plan.trips.length).toBeGreaterThan(0);
    for (const trip of plan.trips) {
      expect(trip.totalWeightKg).toBeLessThanOrEqual(trip.drone.capacityKg);
      expect(trip.totalDistanceKm).toBeLessThanOrEqual(trip.drone.rangeKm);
      expect(trip.batteryAfterPercent).toBeGreaterThanOrEqual(
        BATTERY_RESERVE_PERCENT,
      );
      expect(trip.occupancyPercent).toBeLessThanOrEqual(100);
      expect(trip.orders.length).toBeGreaterThan(0);
    }
  });

  it('usa cada drone no máximo uma vez por plano', () => {
    seedOrders(ctx, 60);

    const plan = ctx.deliveries.plan();
    const droneIds = plan.trips.map((t) => t.drone.id);

    expect(new Set(droneIds).size).toBe(droneIds.length);
    expect(droneIds.length).toBeLessThanOrEqual(ctx.drones.findAll().length);
  });

  it('mantém os totais coerentes com as viagens', () => {
    seedOrders(ctx, 60);

    const plan = ctx.deliveries.plan();

    expect(plan.totalDistanceKm).toBeCloseTo(
      plan.trips.reduce((s, t) => s + t.totalDistanceKm, 0),
      6,
    );
    expect(plan.totalTimeMinutes).toBeCloseTo(
      plan.trips.reduce((s, t) => s + t.estimate.totalMinutes, 0),
      6,
    );
    expect(plan.makespanMinutes).toBeLessThanOrEqual(plan.totalTimeMinutes);
  });

  it('produz a mesma alocação quando replanejado sem mudanças', () => {
    seedOrders(ctx, 60);

    const primeiro = ctx.deliveries.plan();
    const segundo = ctx.deliveries.plan();

    const assinatura = (plan: typeof primeiro): string =>
      plan.trips
        .map((t) => `${t.drone.id}:${t.orders.map((o) => o.id).join(',')}`)
        .sort()
        .join('|');

    expect(assinatura(segundo)).toBe(assinatura(primeiro));
  });

  it('não deixa prioridade alta para trás enquanto sobra baixa', () => {
    for (let i = 0; i < 10; i += 1) {
      addOrder(ctx, {
        x: 1 + (i % 5),
        y: 2,
        weightKg: 5,
        priority: Priority.BAIXA,
      });
    }
    for (let i = 0; i < 10; i += 1) {
      addOrder(ctx, {
        x: 1 + (i % 5),
        y: 4,
        weightKg: 5,
        priority: Priority.ALTA,
      });
    }

    const plan = ctx.deliveries.plan();
    const alocados = plan.trips.flatMap((t) => t.orders);

    expect(alocados).toHaveLength(12);
    expect(
      alocados.filter((o) => o.priority === Priority.ALTA),
    ).toHaveLength(10);
    expect(
      plan.unassigned.filter((u) => u.order.priority === Priority.ALTA),
    ).toEqual([]);
  });

  it('recusa com motivo todo pedido que sobra da rodada', () => {
    seedOrders(ctx, 60);

    for (const item of ctx.deliveries.plan().unassigned) {
      expect(item.reason).toEqual(expect.any(String));
      expect(item.reason.length).toBeGreaterThan(0);
    }
  });
});

describe('carga: simulação com pedidos chegando ao longo do tempo', () => {
  let ctx: SimulationContext;

  beforeEach(async () => {
    jest.useFakeTimers();
    ctx = await createSimulationContext();
  });

  afterEach(async () => {
    await ctx.moduleRef.close();
    jest.useRealTimers();
  });

  it('entrega toda a fila mantendo a alocação correta a cada tick', () => {
    for (let i = 0; i < 3; i += 1) {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60, speedKmh: 60 });
    }
    const orders = seedOrders(ctx, 12, 7);

    const ticks = runUntil(filaVazia(ctx, orders.length), 3000, () =>
      expectFleetInvariants(ctx),
    );

    expect(ticks).toBeLessThan(3000);
    expect(orders.every((o) => o.status === OrderStatus.DELIVERED)).toBe(true);
    expect(orders.every((o) => (o.deliveryMinutes ?? 0) > 0)).toBe(true);
    expect(
      ctx.drones.findAll().reduce((s, d) => s + d.deliveriesCompleted, 0),
    ).toBe(orders.length);
  });

  it('absorve levas de pedidos que chegam com a frota já em voo', () => {
    for (let i = 0; i < 3; i += 1) {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60, speedKmh: 60 });
    }

    const todos: Order[] = [];
    for (let leva = 0; leva < 3; leva += 1) {
      todos.push(...seedOrders(ctx, 5, 11 + leva));
      runUntil(() => false, 25, () => expectFleetInvariants(ctx));
    }

    const ticks = runUntil(filaVazia(ctx, todos.length), 3000, () =>
      expectFleetInvariants(ctx),
    );

    expect(ticks).toBeLessThan(3000);
    expect(todos).toHaveLength(15);
    expect(todos.every((o) => o.status === OrderStatus.DELIVERED)).toBe(true);
    expect(new Set(todos.map((o) => o.id)).size).toBe(15);
    expect(ctx.simulation.snapshot()).toMatchObject({
      activeFlights: 0,
      ordersInTransit: 0,
      ordersDelivered: 15,
    });
  });

  it('não estoura a capacidade de nenhum drone com a frota saturada', () => {
    for (let i = 0; i < 2; i += 1) {
      addDrone(ctx, { capacityKg: 6, rangeKm: 60, speedKmh: 60 });
    }
    const orders = seedOrders(ctx, 20, 99);

    runUntil(filaVazia(ctx, orders.length), 4000, () =>
      expectFleetInvariants(ctx),
    );

    expect(ctx.simulation.snapshot().ordersDelivered).toBe(orders.length);
    expect(ctx.orders.findPending()).toHaveLength(0);
    for (const drone of ctx.drones.findAll()) {
      expect(drone.currentTripId).toBeNull();
      expect(drone.position).toEqual({ x: 0, y: 0 });
    }
  });
});

describe('carga: múltiplos pedidos simultâneos', () => {
  let ctx: DomainContext;

  beforeEach(async () => {
    ctx = await createDomainContext();
    for (let i = 0; i < 8; i += 1) {
      addDrone(ctx, { capacityKg: 12, rangeKm: 80, speedKmh: 50 });
    }
  });

  it('registra 120 pedidos criados em paralelo sem colisão de id', async () => {
    const criados = await inParallel(ctx, 120);

    expect(criados).toHaveLength(120);
    expect(new Set(criados.map((o) => o.id)).size).toBe(120);
    expect(ctx.orders.findAll()).toHaveLength(120);
    expect(ctx.orders.findPending()).toHaveLength(120);
  });

  it('mantém a alocação correta com a fila montada em paralelo', async () => {
    await inParallel(ctx, 120);

    expectPlanIsSound(ctx, ctx.deliveries.plan());
  });

  it('não aloca o mesmo pedido duas vezes quando o plano roda entre as levas', async () => {
    const primeira = await inParallel(ctx, 40);
    const planoParcial = ctx.deliveries.plan();
    expectPlanIsSound(ctx, planoParcial);

    const segunda = await inParallel(ctx, 40, 40);
    const planoFinal = ctx.deliveries.plan();

    expectPlanIsSound(ctx, planoFinal);
    expect(ctx.orders.findAll()).toHaveLength(
      primeira.length + segunda.length,
    );
  });

  it('planeja 200 pedidos com 12 drones sem quebrar nenhuma restrição', () => {
    for (let i = 0; i < 4; i += 1) {
      addDrone(ctx, { capacityKg: 12, rangeKm: 80, speedKmh: 50 });
    }
    seedOrders(ctx, 200, 2024);

    const inicio = Date.now();
    const plan = ctx.deliveries.plan();
    const decorridoMs = Date.now() - inicio;

    expectPlanIsSound(ctx, plan);
    expect(plan.trips.length).toBeGreaterThan(0);
    expect(plan.trips.length).toBeLessThanOrEqual(12);
    expect(decorridoMs).toBeLessThan(10000);
  });

  it('produz o mesmo plano em chamadas concorrentes sobre a mesma fila', async () => {
    const assinatura = (plan: AllocationPlan): string =>
      plan.trips
        .map((t) => `${t.drone.id}:${t.orders.map((o) => o.id).join(',')}`)
        .sort()
        .join('|');

    await inParallel(ctx, 30);
    const antes = assinatura(ctx.deliveries.plan());

    const [depois] = await Promise.all([
      Promise.resolve().then(() => assinatura(ctx.deliveries.plan())),
      Promise.resolve().then(() => assinatura(ctx.deliveries.plan())),
    ]);

    expect(depois).toBe(antes);
  });
});

describe('carga: simulação com a frota saturada', () => {
  let ctx: SimulationContext;

  beforeEach(async () => {
    jest.useFakeTimers();
    ctx = await createSimulationContext();
    for (let i = 0; i < 6; i += 1) {
      addDrone(ctx, { capacityKg: 10, rangeKm: 80, speedKmh: 60 });
    }
  });

  afterEach(async () => {
    await ctx.moduleRef.close();
    jest.useRealTimers();
  });

  it('nunca deixa um pedido em dois voos ao mesmo tempo', async () => {
    const orders = await inParallel(ctx, 30);
    const entregues = new Set<string>();

    const ticks = runUntil(filaVazia(ctx, orders.length), 5000, () => {
      expectFleetInvariants(ctx);
      expectSingleAssignment(ctx);

      for (const id of entregues) {
        expect(ctx.orders.findById(id).status).toBe(OrderStatus.DELIVERED);
      }
      for (const order of ctx.orders.findAll()) {
        if (order.status === OrderStatus.DELIVERED) entregues.add(order.id);
      }
    });

    expect(ticks).toBeLessThan(5000);
    expect(entregues.size).toBe(orders.length);
  });

  it('entrega cada pedido exatamente uma vez sob saturação', async () => {
    const orders = await inParallel(ctx, 30);

    runUntil(filaVazia(ctx, orders.length), 5000);

    const snapshot = ctx.simulation.snapshot();
    expect(snapshot.ordersDelivered).toBe(orders.length);
    expect(snapshot.ordersInTransit).toBe(0);
    expect(snapshot.activeFlights).toBe(0);
    expect(
      ctx.drones.findAll().reduce((s, d) => s + d.deliveriesCompleted, 0),
    ).toBe(orders.length);
    expect(orders.every((o) => o.status === OrderStatus.DELIVERED)).toBe(true);
    expect(new Set(orders.map((o) => o.assignedDroneId)).has(null)).toBe(false);
  });

  it('devolve toda a frota à base com a fila zerada', async () => {
    const orders = await inParallel(ctx, 30);

    runUntil(filaVazia(ctx, orders.length), 5000);

    expect(ctx.orders.findPending()).toHaveLength(0);
    for (const drone of ctx.drones.findAll()) {
      expect(drone.currentTripId).toBeNull();
      expect(drone.position).toEqual({ x: 0, y: 0 });
      expect(drone.batteryPercent).toBeGreaterThanOrEqual(0);
    }
  });
});
