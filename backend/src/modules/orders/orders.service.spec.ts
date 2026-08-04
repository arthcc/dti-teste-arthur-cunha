import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import {
  BATTERY_RESERVE_PERCENT,
  GRID_SIZE,
} from '../../common/config/simulation.config';
import { Priority } from '../../common/enums/priority.enum';
import {
  DomainContext,
  addDrone,
  addOrder,
  addZone,
  createDomainContext,
  encircle,
} from '../../testing/test-context';
import { OrderStatus } from './interfaces/order.interface';

describe('OrdersService', () => {
  let ctx: DomainContext;

  beforeEach(async () => {
    ctx = await createDomainContext();
  });

  describe('create', () => {
    it('registra o pedido pendente e sem drone', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60 });

      const order = addOrder(ctx, {
        x: 5,
        y: 8,
        weightKg: 3.5,
        priority: Priority.ALTA,
      });

      expect(order).toMatchObject({
        location: { x: 5, y: 8 },
        weightKg: 3.5,
        priority: Priority.ALTA,
        status: OrderStatus.PENDING,
        assignedDroneId: null,
        deliveredAt: null,
        deliveryMinutes: null,
      });
      expect(ctx.orders.findPending()).toHaveLength(1);
    });
  });

  describe('pacote acima da capacidade', () => {
    it('recusa peso acima do maior drone da frota', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60 });

      expect(() => addOrder(ctx, { x: 2, y: 2, weightKg: 10.5 })).toThrow(
        UnprocessableEntityException,
      );
      expect(ctx.orders.findAll()).toHaveLength(0);
    });

    it('explica qual é o limite da frota', () => {
      addDrone(ctx, { capacityKg: 4, rangeKm: 60 });
      addDrone(ctx, { capacityKg: 10, rangeKm: 60 });

      expect(() => addOrder(ctx, { x: 2, y: 2, weightKg: 12 })).toThrow(
        /12 kg excede a capacidade do maior drone da frota \(10 kg\)/,
      );
    });

    it('aceita peso exatamente igual à capacidade', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60 });

      expect(() => addOrder(ctx, { x: 2, y: 2, weightKg: 10 })).not.toThrow();
    });

    it('não aplica limite de peso com a frota vazia', () => {
      const order = addOrder(ctx, { x: 2, y: 2, weightKg: 400 });

      expect(order.weightKg).toBe(400);
    });
  });

  describe('destino inválido', () => {
    it('recusa destino dentro de uma zona de exclusão', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
      addZone(ctx, { minX: 4, minY: 4, maxX: 8, maxY: 9 }, 'Centro');

      expect(() => addOrder(ctx, { x: 6, y: 6 })).toThrow(
        /dentro da zona de exclusão "Centro"/,
      );
    });

    it('recusa destino cercado por zonas', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
      for (const rect of encircle(10, 10)) addZone(ctx, rect);

      expect(() => addOrder(ctx, { x: 10, y: 10 })).toThrow(
        /cercado por zonas de exclusão aérea/,
      );
    });

    it('recusa destino além do alcance útil da frota', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 10 });

      expect(() =>
        addOrder(ctx, { x: GRID_SIZE, y: GRID_SIZE }),
      ).toThrow(UnprocessableEntityException);
    });

    it('desconta a reserva de bateria do alcance anunciado', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 20 });
      const alcanceUtil = 20 * (1 - BATTERY_RESERVE_PERCENT / 100);

      expect(alcanceUtil).toBeCloseTo(17, 6);
      expect(() => addOrder(ctx, { x: 8, y: 0 })).not.toThrow();
      expect(() => addOrder(ctx, { x: 9, y: 0 })).toThrow(
        UnprocessableEntityException,
      );
    });

    it('não aplica limite de alcance com a frota vazia', () => {
      expect(() =>
        addOrder(ctx, { x: GRID_SIZE, y: GRID_SIZE }),
      ).not.toThrow();
    });

    it('rejeita destino cercado mesmo sem frota', () => {
      for (const rect of encircle(10, 10)) addZone(ctx, rect);

      expect(() => addOrder(ctx, { x: 10, y: 10 })).toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('limits', () => {
    it('reflete a frota vigente', () => {
      addDrone(ctx, { capacityKg: 6, rangeKm: 30 });
      addDrone(ctx, { capacityKg: 12, rangeKm: 18 });

      expect(ctx.orders.limits()).toEqual({
        gridSize: GRID_SIZE,
        fleetSize: 2,
        maxCapacityKg: 12,
        maxRangeKm: 30,
        batteryReservePercent: BATTERY_RESERVE_PERCENT,
      });
    });

    it('zera capacidade e alcance com a frota vazia', () => {
      expect(ctx.orders.limits()).toMatchObject({
        fleetSize: 0,
        maxCapacityKg: 0,
        maxRangeKm: 0,
      });
    });
  });

  describe('ciclo de vida do pedido', () => {
    it('percorre alocado, em trânsito e entregue', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
      const order = addOrder(ctx, { x: 3, y: 0 });

      ctx.orders.markAllocated(order.id, 'drone-1');
      expect(order.status).toBe(OrderStatus.ALLOCATED);
      expect(order.assignedDroneId).toBe('drone-1');
      expect(ctx.orders.findPending()).toHaveLength(0);

      ctx.orders.markInTransit(order.id);
      expect(order.status).toBe(OrderStatus.IN_TRANSIT);

      ctx.orders.markDelivered(order.id, 18.44);
      expect(order.status).toBe(OrderStatus.DELIVERED);
      expect(order.deliveryMinutes).toBe(18.4);
      expect(order.deliveredAt).toBeInstanceOf(Date);
    });

    it('devolve o pedido para a fila quando a viagem é abortada', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
      const order = addOrder(ctx, { x: 3, y: 0 });
      ctx.orders.markAllocated(order.id, 'drone-1');

      ctx.orders.releaseToQueue(order.id);

      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.assignedDroneId).toBeNull();
      expect(ctx.orders.findPending()).toHaveLength(1);
    });

    it('reinicia todos os pedidos', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
      const order = addOrder(ctx, { x: 3, y: 0 });
      ctx.orders.markAllocated(order.id, 'drone-1');
      ctx.orders.markDelivered(order.id, 10);

      ctx.orders.resetAll();

      expect(order).toMatchObject({
        status: OrderStatus.PENDING,
        assignedDroneId: null,
        deliveredAt: null,
        deliveryMinutes: null,
      });
    });

    it('falha para um id inexistente', () => {
      expect(() => ctx.orders.findById('nao-existe')).toThrow(
        NotFoundException,
      );
    });
  });
});
