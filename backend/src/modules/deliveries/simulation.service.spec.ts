import {
  RECHARGE_PERCENT_PER_MINUTE,
  SIM_MINUTES_PER_TICK,
} from '../../common/config/simulation.config';
import { DroneState } from '../../common/enums/drone-state.enum';
import { BASE } from '../../common/utils/geo.util';
import {
  SimulationContext,
  addDrone,
  addOrder,
  advanceTicks,
  createSimulationContext,
  runUntil,
} from '../../testing/test-context';
import { OrderStatus } from '../orders/interfaces/order.interface';

describe('SimulationService', () => {
  let ctx: SimulationContext;

  beforeEach(async () => {
    jest.useFakeTimers();
    ctx = await createSimulationContext();
  });

  afterEach(async () => {
    await ctx.moduleRef.close();
    jest.useRealTimers();
  });

  describe('relógio', () => {
    it('começa rodando e zerado', () => {
      expect(ctx.simulation.snapshot()).toMatchObject({
        running: true,
        clockMinutes: 0,
        minutesPerTick: SIM_MINUTES_PER_TICK,
        activeFlights: 0,
        ordersDelivered: 0,
        ordersInTransit: 0,
        averageDeliveryMinutes: null,
        totalFlightMinutes: 0,
      });
    });

    it('avança os minutos configurados a cada tick', () => {
      advanceTicks(10);

      expect(ctx.simulation.snapshot().clockMinutes).toBeCloseTo(
        10 * SIM_MINUTES_PER_TICK,
        6,
      );
    });

    it('congela o relógio quando pausada', () => {
      advanceTicks(4);
      const pausado = ctx.simulation.setRunning(false);

      advanceTicks(50);

      expect(pausado.running).toBe(false);
      expect(ctx.simulation.snapshot().clockMinutes).toBe(pausado.clockMinutes);
    });

    it('volta a avançar quando retomada', () => {
      ctx.simulation.setRunning(false);
      advanceTicks(10);
      ctx.simulation.setRunning(true);
      advanceTicks(6);

      expect(ctx.simulation.snapshot().clockMinutes).toBeCloseTo(
        6 * SIM_MINUTES_PER_TICK,
        6,
      );
    });

    it('para de avançar depois que o módulo é destruído', async () => {
      advanceTicks(4);
      const antes = ctx.simulation.snapshot().clockMinutes;

      await ctx.moduleRef.close();
      advanceTicks(20);

      expect(ctx.simulation.snapshot().clockMinutes).toBe(antes);
    });
  });

  describe('recarga na base', () => {
    it('recarrega o drone ocioso pela taxa configurada', () => {
      const drone = addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
      ctx.drones.update(drone.id, { batteryPercent: 50 });

      advanceTicks(10);

      expect(drone.batteryPercent).toBeCloseTo(
        50 + 10 * SIM_MINUTES_PER_TICK * RECHARGE_PERCENT_PER_MINUTE,
        6,
      );
    });

    it('não passa de 100%', () => {
      const drone = addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
      ctx.drones.update(drone.id, { batteryPercent: 95 });

      advanceTicks(20);

      expect(drone.batteryPercent).toBe(100);
    });
  });

  describe('ciclo completo de uma entrega', () => {
    it('carrega, voa, entrega e volta para a base', () => {
      const drone = addDrone(ctx, {
        capacityKg: 10,
        rangeKm: 60,
        speedKmh: 60,
      });
      const order = addOrder(ctx, { x: 5, y: 0, weightKg: 2 });

      advanceTicks(1);
      expect(drone.state).toBe(DroneState.LOADING);
      expect(order.status).toBe(OrderStatus.ALLOCATED);
      expect(ctx.simulation.snapshot().activeFlights).toBe(1);

      const ticks = runUntil(() => order.status === OrderStatus.DELIVERED, 400);

      expect(ticks).toBeLessThan(400);
      expect(order.deliveryMinutes).toBeGreaterThan(0);
      expect(drone.batteryPercent).toBeLessThan(100);

      runUntil(() => ctx.simulation.snapshot().activeFlights === 0, 400);

      expect(drone.state).toBe(DroneState.IDLE);
      expect(drone.position).toEqual(BASE);
      expect(drone.currentTripId).toBeNull();
      expect(drone.deliveriesCompleted).toBe(1);
      expect(ctx.simulation.snapshot()).toMatchObject({
        activeFlights: 0,
        ordersDelivered: 1,
        ordersInTransit: 0,
      });
    });

    it('percorre as fases sem sair da malha nem furar a bateria', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60, speedKmh: 60 });
      const drone = ctx.drones.findAll()[0];
      addOrder(ctx, { x: 4, y: 3, weightKg: 2 });

      const estados = new Set<DroneState>();
      runUntil(
        () => ctx.simulation.snapshot().ordersDelivered === 1,
        400,
        () => {
          estados.add(drone.state);
          expect(drone.batteryPercent).toBeGreaterThan(0);
          expect(drone.position.x).toBeGreaterThanOrEqual(0);
          expect(drone.position.y).toBeGreaterThanOrEqual(0);
        },
      );

      expect(estados.has(DroneState.LOADING)).toBe(true);
      expect(estados.has(DroneState.IN_FLIGHT)).toBe(true);
      expect(estados.has(DroneState.DELIVERING)).toBe(true);
    });

    it('entrega as duas paradas de uma viagem e calcula a média', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60, speedKmh: 60 });
      const perto = addOrder(ctx, { x: 2, y: 0, weightKg: 4 });
      const longe = addOrder(ctx, { x: 6, y: 0, weightKg: 4 });

      runUntil(() => ctx.simulation.snapshot().ordersDelivered === 2, 800);

      expect(perto.status).toBe(OrderStatus.DELIVERED);
      expect(longe.status).toBe(OrderStatus.DELIVERED);
      expect(perto.deliveryMinutes!).toBeLessThan(longe.deliveryMinutes!);
      expect(ctx.simulation.snapshot().averageDeliveryMinutes).toBeCloseTo(
        Number(
          ((perto.deliveryMinutes! + longe.deliveryMinutes!) / 2).toFixed(1),
        ),
        1,
      );
    });

    it('deixa o pedido inviável parado sem ocupar drone', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60, speedKmh: 60 });
      const order = addOrder(ctx, { x: 6, y: 6, weightKg: 2 });
      ctx.zones.create({ minX: 4, minY: 4, maxX: 8, maxY: 9 });

      advanceTicks(60);

      expect(order.status).toBe(OrderStatus.PENDING);
      expect(ctx.simulation.snapshot().activeFlights).toBe(0);
      expect(ctx.drones.findAll()[0].state).toBe(DroneState.IDLE);
    });
  });

  describe('reset', () => {
    it('zera o relógio e devolve frota e pedidos ao início', () => {
      const drone = addDrone(ctx, {
        capacityKg: 10,
        rangeKm: 60,
        speedKmh: 60,
      });
      const order = addOrder(ctx, { x: 5, y: 0, weightKg: 2 });
      runUntil(() => order.status === OrderStatus.DELIVERED, 400);

      const snapshot = ctx.simulation.reset();

      expect(snapshot).toMatchObject({
        clockMinutes: 0,
        activeFlights: 0,
        ordersDelivered: 0,
        totalFlightMinutes: 0,
        averageDeliveryMinutes: null,
      });
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(drone).toMatchObject({
        state: DroneState.IDLE,
        batteryPercent: 100,
        deliveriesCompleted: 0,
      });
      expect(drone.position).toEqual(BASE);
    });
  });
});
