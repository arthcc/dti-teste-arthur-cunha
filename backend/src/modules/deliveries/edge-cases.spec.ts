import { UnprocessableEntityException } from '@nestjs/common';
import {
  BATTERY_RESERVE_PERCENT,
  MIN_DISPATCH_BATTERY_PERCENT,
} from '../../common/config/simulation.config';
import { DroneState } from '../../common/enums/drone-state.enum';
import { Priority } from '../../common/enums/priority.enum';
import {
  DomainContext,
  SimulationContext,
  addDrone,
  addOrder,
  addZone,
  advanceTicks,
  createDomainContext,
  createSimulationContext,
  runUntil,
} from '../../testing/test-context';
import { OrderStatus } from '../orders/interfaces/order.interface';

describe('edge case: pacote acima da capacidade', () => {
  let ctx: DomainContext;

  beforeEach(async () => {
    ctx = await createDomainContext();
  });

  it('recusa o pedido quando o único drone que comporta o peso está em voo', () => {
    const grande = addDrone(ctx, { capacityKg: 20, rangeKm: 60 });
    addDrone(ctx, { capacityKg: 5, rangeKm: 60 });
    const pedido = addOrder(ctx, { x: 3, y: 3, weightKg: 12 });

    ctx.drones.update(grande.id, { state: DroneState.IN_FLIGHT });
    const plan = ctx.deliveries.plan();

    expect(plan.trips).toEqual([]);
    expect(plan.unassigned).toHaveLength(1);
    expect(plan.unassigned[0].order.id).toBe(pedido.id);
    expect(plan.unassigned[0].reason).toMatch(
      /Pacote de 12 kg acima da capacidade dos drones disponíveis \(máx 5 kg\)/,
    );
  });

  it('volta a alocar o mesmo pedido assim que o drone maior fica ocioso', () => {
    const grande = addDrone(ctx, { capacityKg: 20, rangeKm: 60 });
    addDrone(ctx, { capacityKg: 5, rangeKm: 60 });
    const pedido = addOrder(ctx, { x: 3, y: 3, weightKg: 12 });

    ctx.drones.update(grande.id, { state: DroneState.IN_FLIGHT });
    expect(ctx.deliveries.plan().unassigned).toHaveLength(1);

    ctx.drones.update(grande.id, { state: DroneState.IDLE });
    const plan = ctx.deliveries.plan();

    expect(plan.unassigned).toEqual([]);
    expect(plan.trips).toHaveLength(1);
    expect(plan.trips[0].drone.id).toBe(grande.id);
    expect(plan.trips[0].orders.map((o) => o.id)).toEqual([pedido.id]);
  });

  it('não ultrapassa a capacidade somando pesos fracionários', () => {
    addDrone(ctx, { capacityKg: 2.8, rangeKm: 60 });
    for (let i = 0; i < 4; i += 1) {
      addOrder(ctx, { x: 2 + i, y: 2, weightKg: 0.7 });
    }

    const plan = ctx.deliveries.plan();
    const alocados = plan.trips.flatMap((t) => t.orders);

    expect(plan.trips).toHaveLength(1);
    expect(plan.trips[0].totalWeightKg).toBeLessThanOrEqual(2.8);
    expect(plan.trips[0].occupancyPercent).toBeLessThanOrEqual(100);
    expect(alocados.length + plan.unassigned.length).toBe(4);
  });

  it('deixa o excedente na fila em vez de estourar o único drone', () => {
    addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
    for (let i = 0; i < 3; i += 1) {
      addOrder(ctx, { x: 2 + i, y: 2, weightKg: 6 });
    }

    const plan = ctx.deliveries.plan();

    expect(plan.trips).toHaveLength(1);
    expect(plan.trips[0].orders).toHaveLength(1);
    expect(plan.trips[0].totalWeightKg).toBe(6);
    expect(plan.unassigned).toHaveLength(2);
    for (const item of plan.unassigned) {
      expect(item.reason).toMatch(/Não coube nas viagens desta rodada/);
    }
  });

  it('recusa o registro do pedido que nenhum drone da frota comporta', () => {
    addDrone(ctx, { capacityKg: 8, rangeKm: 60 });

    expect(() => addOrder(ctx, { x: 3, y: 3, weightKg: 8.001 })).toThrow(
      UnprocessableEntityException,
    );
    expect(ctx.orders.findAll()).toEqual([]);
  });
});

describe('edge case: drone sem carga suficiente', () => {
  let ctx: DomainContext;

  beforeEach(async () => {
    ctx = await createDomainContext();
  });

  it('despacha o drone parado no piso de bateria quando a viagem cabe na reserva', () => {
    const drone = addDrone(ctx, { capacityKg: 10, rangeKm: 200 });
    ctx.drones.update(drone.id, {
      batteryPercent: MIN_DISPATCH_BATTERY_PERCENT,
    });
    addOrder(ctx, { x: 1, y: 1, weightKg: 1 });

    const plan = ctx.deliveries.plan();

    expect(plan.trips).toHaveLength(1);
    expect(plan.trips[0].batteryAfterPercent).toBeGreaterThanOrEqual(
      BATTERY_RESERVE_PERCENT,
    );
  });

  it('segura o pedido quando a bateria cobre a ida mas não a reserva', () => {
    const drone = addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
    ctx.drones.update(drone.id, {
      batteryPercent: MIN_DISPATCH_BATTERY_PERCENT,
    });
    addOrder(ctx, { x: 6, y: 6, weightKg: 1 });

    const plan = ctx.deliveries.plan();

    expect(plan.trips).toEqual([]);
    expect(plan.unassigned).toHaveLength(1);
    expect(plan.unassigned[0].reason).toMatch(
      new RegExp(`${BATTERY_RESERVE_PERCENT}% de reserva`),
    );
  });

  it('prefere o drone mais carregado entre dois de mesma capacidade', () => {
    const fraco = addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
    const cheio = addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
    ctx.drones.update(fraco.id, { batteryPercent: 50 });
    addOrder(ctx, { x: 4, y: 4, weightKg: 9 });

    const plan = ctx.deliveries.plan();

    expect(plan.trips).toHaveLength(1);
    expect(plan.trips[0].drone.id).toBe(cheio.id);
  });
});

describe('edge case: drone sem carga suficiente na simulação', () => {
  let ctx: SimulationContext;

  beforeEach(async () => {
    jest.useFakeTimers();
    ctx = await createSimulationContext();
    addDrone(ctx, { capacityKg: 10, rangeKm: 60, speedKmh: 60 });
  });

  afterEach(async () => {
    await ctx.moduleRef.close();
    jest.useRealTimers();
  });

  it('aborta a viagem e devolve o pedido à fila quando a bateria zera em voo', () => {
    const pedido = addOrder(ctx, { x: 5, y: 5, weightKg: 2 });
    const drone = ctx.drones.findAll()[0];

    runUntil(() => ctx.simulation.snapshot().activeFlights === 1, 20);
    expect(pedido.status).toBe(OrderStatus.ALLOCATED);

    ctx.drones.update(drone.id, { batteryPercent: 0 });
    advanceTicks(1);

    expect(ctx.simulation.snapshot().activeFlights).toBe(0);
    expect(pedido.status).toBe(OrderStatus.PENDING);
    expect(pedido.assignedDroneId).toBeNull();
    expect(pedido.deliveryMinutes).toBeNull();
    expect(drone.state).toBe(DroneState.IDLE);
    expect(drone.position).toEqual({ x: 0, y: 0 });
    expect(drone.currentTripId).toBeNull();
    expect(drone.batteryPercent).toBeGreaterThanOrEqual(0);
    expect(drone.deliveriesCompleted).toBe(0);
  });

  it('não redespacha enquanto a carga está abaixo do piso de despacho', () => {
    addOrder(ctx, { x: 5, y: 5, weightKg: 2 });
    const drone = ctx.drones.findAll()[0];

    runUntil(() => ctx.simulation.snapshot().activeFlights === 1, 20);
    ctx.drones.update(drone.id, { batteryPercent: 0 });
    advanceTicks(1);

    advanceTicks(2, () => {
      if (drone.batteryPercent < MIN_DISPATCH_BATTERY_PERCENT) {
        expect(ctx.simulation.snapshot().activeFlights).toBe(0);
      }
    });

    expect(drone.batteryPercent).toBeGreaterThan(0);
    expect(drone.batteryPercent).toBeLessThan(MIN_DISPATCH_BATTERY_PERCENT);
    expect(ctx.simulation.snapshot().activeFlights).toBe(0);
  });

  it('recarrega na base e reassume o pedido devolvido pela viagem abortada', () => {
    const pedido = addOrder(ctx, { x: 5, y: 5, weightKg: 2 });
    const drone = ctx.drones.findAll()[0];

    runUntil(() => ctx.simulation.snapshot().activeFlights === 1, 20);
    ctx.drones.update(drone.id, { batteryPercent: 0 });
    advanceTicks(1);
    expect(pedido.status).toBe(OrderStatus.PENDING);

    const ticks = runUntil(
      () => pedido.status === OrderStatus.DELIVERED,
      2000,
      () => {
        expect(drone.batteryPercent).toBeGreaterThanOrEqual(0);
        expect(drone.batteryPercent).toBeLessThanOrEqual(100);
      },
    );

    expect(ticks).toBeLessThan(2000);
    expect(pedido.deliveryMinutes).toBeGreaterThan(0);
    expect(drone.deliveriesCompleted).toBe(1);
  });
});

describe('edge case: coordenadas inválidas', () => {
  let ctx: DomainContext;

  beforeEach(async () => {
    ctx = await createDomainContext();
  });

  it('aceita o destino na própria base como viagem de distância zero', () => {
    addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
    addOrder(ctx, { x: 0, y: 0, weightKg: 1 });

    const plan = ctx.deliveries.plan();

    expect(plan.trips).toHaveLength(1);
    expect(plan.trips[0].totalDistanceKm).toBe(0);
    expect(plan.trips[0].detourKm).toBe(0);
    expect(plan.trips[0].path).toEqual([{ x: 0, y: 0 }]);
  });

  it('recusa o canto da malha quando a ida e volta estoura o alcance útil', () => {
    addDrone(ctx, { capacityKg: 10, rangeKm: 60 });

    expect(() => addOrder(ctx, { x: 20, y: 20, weightKg: 1 })).toThrow(
      UnprocessableEntityException,
    );
  });

  it('aceita o canto da malha com um drone de alcance suficiente', () => {
    addDrone(ctx, { capacityKg: 10, rangeKm: 70 });
    addOrder(ctx, { x: 20, y: 20, weightKg: 1 });

    const plan = ctx.deliveries.plan();

    expect(plan.trips).toHaveLength(1);
    expect(plan.trips[0].totalDistanceKm).toBeCloseTo(40 * Math.SQRT2, 6);
    expect(plan.trips[0].batteryAfterPercent).toBeGreaterThanOrEqual(
      BATTERY_RESERVE_PERCENT,
    );
  });

  it('recusa no serviço o destino fora da malha, sem depender do ValidationPipe', () => {
    addDrone(ctx, { capacityKg: 10, rangeKm: 60 });

    expect(() =>
      ctx.orders.create({
        location: { x: 99, y: 99 },
        weightKg: 1,
        priority: Priority.MEDIA,
      }),
    ).toThrow(UnprocessableEntityException);
    expect(ctx.orders.findAll()).toEqual([]);
  });

  it('trata a borda da zona de exclusão como ponto proibido', () => {
    addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
    addZone(ctx, { minX: 4, maxX: 6, minY: 4, maxY: 6 }, 'Centro');

    expect(() => addOrder(ctx, { x: 4, y: 4, weightKg: 1 })).toThrow(
      UnprocessableEntityException,
    );
    expect(() => addOrder(ctx, { x: 6, y: 6, weightKg: 1 })).toThrow(
      UnprocessableEntityException,
    );

    const vizinho = addOrder(ctx, { x: 3, y: 4, weightKg: 1 });

    expect(vizinho.status).toBe(OrderStatus.PENDING);
    expect(ctx.deliveries.plan().trips).toHaveLength(1);
  });

  it('recusa o destino cercado por zonas mesmo com a frota sobrando', () => {
    addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
    addZone(ctx, { minX: 7, maxX: 9, minY: 7, maxY: 7 }, 'N');
    addZone(ctx, { minX: 7, maxX: 9, minY: 9, maxY: 9 }, 'S');
    addZone(ctx, { minX: 7, maxX: 7, minY: 8, maxY: 8 }, 'O');
    addZone(ctx, { minX: 9, maxX: 9, minY: 8, maxY: 8 }, 'L');

    expect(() => addOrder(ctx, { x: 8, y: 8, weightKg: 1 })).toThrow(
      UnprocessableEntityException,
    );
  });
});
