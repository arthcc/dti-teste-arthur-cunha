import {
  BATTERY_RESERVE_PERCENT,
  LOADING_MINUTES,
  MIN_DISPATCH_BATTERY_PERCENT,
  SERVICE_MINUTES_PER_STOP,
} from '../../common/config/simulation.config';
import { DroneState } from '../../common/enums/drone-state.enum';
import { Priority } from '../../common/enums/priority.enum';
import { isBlocked } from '../../common/utils/geo.util';
import {
  DomainContext,
  addDrone,
  addOrder,
  addZone,
  createDomainContext,
} from '../../testing/test-context';

describe('DeliveriesService.plan', () => {
  let ctx: DomainContext;

  beforeEach(async () => {
    ctx = await createDomainContext();
  });

  describe('sem drone despachável', () => {
    it('explica que a frota está vazia', () => {
      const plan = ctx.deliveries.plan();
      expect(plan.trips).toEqual([]);

      addOrder(ctx, { x: 3, y: 0 });
      const comPedido = ctx.deliveries.plan();

      expect(comPedido.trips).toEqual([]);
      expect(comPedido.unassigned).toHaveLength(1);
      expect(comPedido.unassigned[0].reason).toMatch(/Nenhum drone cadastrado/);
    });

    it('explica que todos estão em voo', () => {
      const drone = addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
      addOrder(ctx, { x: 3, y: 0 });
      ctx.drones.update(drone.id, { state: DroneState.IN_FLIGHT });

      expect(ctx.deliveries.plan().unassigned[0].reason).toMatch(
        /Todos os drones estão em voo/,
      );
    });

    it('explica que os drones na base estão recarregando', () => {
      const drone = addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
      addOrder(ctx, { x: 3, y: 0 });
      ctx.drones.update(drone.id, {
        batteryPercent: MIN_DISPATCH_BATTERY_PERCENT - 1,
      });

      expect(ctx.deliveries.plan().unassigned[0].reason).toMatch(
        /recarregando/,
      );
    });
  });

  describe('viagem simples', () => {
    it('calcula distância, ocupação, tempo e bateria da viagem', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 20, speedKmh: 40 });
      addOrder(ctx, { x: 3, y: 0, weightKg: 4 });

      const plan = ctx.deliveries.plan();

      expect(plan.trips).toHaveLength(1);
      const trip = plan.trips[0];

      expect(trip.orders).toHaveLength(1);
      expect(trip.totalWeightKg).toBe(4);
      expect(trip.occupancyPercent).toBe(40);
      expect(trip.totalDistanceKm).toBeCloseTo(6, 6);
      expect(trip.detourKm).toBeCloseTo(0, 6);
      expect(trip.estimate.flightMinutes).toBeCloseTo(9, 6);
      expect(trip.estimate.serviceMinutes).toBe(SERVICE_MINUTES_PER_STOP);
      expect(trip.estimate.loadingMinutes).toBe(LOADING_MINUTES);
      expect(trip.estimate.totalMinutes).toBeCloseTo(14, 6);
      expect(trip.estimate.batteryPercent).toBeCloseTo(32, 6);
      expect(trip.batteryAfterPercent).toBeCloseTo(68, 6);
    });

    it('devolve a polilinha fechada na base', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 20 });
      addOrder(ctx, { x: 3, y: 0 });

      const { path } = ctx.deliveries.plan().trips[0];

      expect(path[0]).toEqual({ x: 0, y: 0 });
      expect(path[path.length - 1]).toEqual({ x: 0, y: 0 });
    });

    it('agrega os totais do plano', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 20, speedKmh: 40 });
      addDrone(ctx, { capacityKg: 10, rangeKm: 20, speedKmh: 40 });
      addOrder(ctx, { x: 3, y: 0, weightKg: 10 });
      addOrder(ctx, { x: 4, y: 0, weightKg: 10 });

      const plan = ctx.deliveries.plan();

      expect(plan.trips).toHaveLength(2);
      expect(plan.totalTimeMinutes).toBeCloseTo(
        plan.trips.reduce((s, t) => s + t.estimate.totalMinutes, 0),
        6,
      );
      expect(plan.makespanMinutes).toBeCloseTo(
        Math.max(...plan.trips.map((t) => t.estimate.totalMinutes)),
        6,
      );
      expect(plan.totalDistanceKm).toBeCloseTo(6 + 8, 6);
    });
  });

  describe('edge case: pacote acima da capacidade', () => {
    it('recusa o pedido que nenhum drone disponível comporta', () => {
      const grande = addDrone(ctx, { capacityKg: 20, rangeKm: 20 });
      addDrone(ctx, { capacityKg: 5, rangeKm: 20 });
      addOrder(ctx, { x: 2, y: 0, weightKg: 10 });
      ctx.drones.update(grande.id, { state: DroneState.IN_FLIGHT });

      const plan = ctx.deliveries.plan();

      expect(plan.trips).toEqual([]);
      expect(plan.unassigned[0].reason).toBe(
        'Pacote de 10 kg acima da capacidade dos drones disponíveis (máx 5 kg).',
      );
    });

    it('para de encher a viagem quando o próximo pacote estoura a capacidade', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 40 });
      addOrder(ctx, { x: 2, y: 0, weightKg: 6 });
      addOrder(ctx, { x: 3, y: 0, weightKg: 6 });

      const plan = ctx.deliveries.plan();

      expect(plan.trips).toHaveLength(1);
      expect(plan.trips[0].orders).toHaveLength(1);
      expect(plan.trips[0].totalWeightKg).toBe(6);
      expect(plan.unassigned).toHaveLength(1);
      expect(plan.unassigned[0].reason).toMatch(/Não coube nas viagens/);
    });

    it('lota o drone até o limite exato sem ultrapassá-lo', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 40 });
      addOrder(ctx, { x: 2, y: 0, weightKg: 4 });
      addOrder(ctx, { x: 3, y: 0, weightKg: 6 });
      addOrder(ctx, { x: 4, y: 0, weightKg: 1 });

      const trip = ctx.deliveries.plan().trips[0];

      expect(trip.totalWeightKg).toBe(10);
      expect(trip.occupancyPercent).toBe(100);
      expect(trip.orders).toHaveLength(2);
    });
  });

  describe('edge case: drone sem carga suficiente', () => {
    it('recusa a viagem que não deixaria a reserva de bateria', () => {
      const drone = addDrone(ctx, {
        capacityKg: 10,
        rangeKm: 20,
        speedKmh: 40,
      });
      addOrder(ctx, { x: 5, y: 0, weightKg: 1 });
      ctx.drones.update(drone.id, { batteryPercent: 25 });

      const plan = ctx.deliveries.plan();

      expect(plan.trips).toEqual([]);
      expect(plan.unassigned[0].reason).toBe(
        `A viagem exige ~52% de bateria mais ${BATTERY_RESERVE_PERCENT}% de reserva; ` +
          'o drone mais carregado que atende tem 25%.',
      );
    });

    it('aceita a viagem que fecha exatamente na reserva', () => {
      const drone = addDrone(ctx, {
        capacityKg: 10,
        rangeKm: 20,
        speedKmh: 40,
      });
      addOrder(ctx, { x: 5, y: 0, weightKg: 1 });
      ctx.drones.update(drone.id, {
        batteryPercent: 52 + BATTERY_RESERVE_PERCENT,
      });

      const plan = ctx.deliveries.plan();

      expect(plan.trips).toHaveLength(1);
      expect(plan.trips[0].batteryAfterPercent).toBeCloseTo(
        BATTERY_RESERVE_PERCENT,
        6,
      );
    });

    it('encurta a viagem quando a bateria não cobre todas as paradas', () => {
      const drone = addDrone(ctx, {
        capacityKg: 50,
        rangeKm: 40,
        speedKmh: 40,
      });
      addOrder(ctx, { x: 2, y: 0, weightKg: 1 });
      addOrder(ctx, { x: 15, y: 0, weightKg: 1 });
      ctx.drones.update(drone.id, { batteryPercent: 40 });

      const plan = ctx.deliveries.plan();

      expect(plan.trips).toHaveLength(1);
      expect(plan.trips[0].orders).toHaveLength(1);
      expect(plan.trips[0].orders[0].location).toEqual({ x: 2, y: 0 });
      expect(plan.trips[0].batteryAfterPercent).toBeGreaterThanOrEqual(
        BATTERY_RESERVE_PERCENT,
      );
    });

    it('mantém a reserva em todas as viagens planejadas', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 40, speedKmh: 40 });
      addDrone(ctx, { capacityKg: 10, rangeKm: 40, speedKmh: 40 });
      for (let i = 1; i <= 8; i += 1) {
        addOrder(ctx, { x: i, y: i, weightKg: 3 });
      }

      for (const trip of ctx.deliveries.plan().trips) {
        expect(trip.batteryAfterPercent).toBeGreaterThanOrEqual(
          BATTERY_RESERVE_PERCENT,
        );
      }
    });
  });

  describe('edge case: destino inalcançável', () => {
    it('reporta o destino que virou zona de exclusão depois do registro', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
      addOrder(ctx, { x: 6, y: 6 });
      addZone(ctx, { minX: 4, minY: 4, maxX: 8, maxY: 9 }, 'Centro');

      const plan = ctx.deliveries.plan();

      expect(plan.trips).toEqual([]);
      expect(plan.unassigned[0].reason).toBe(
        'Destino dentro da zona de exclusão "Centro".',
      );
    });

    it('reporta o destino cercado por zonas', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
      addOrder(ctx, { x: 10, y: 10 });
      addZone(ctx, { minX: 9, maxX: 11, minY: 9, maxY: 9 });
      addZone(ctx, { minX: 9, maxX: 11, minY: 11, maxY: 11 });
      addZone(ctx, { minX: 9, maxX: 9, minY: 10, maxY: 10 });
      addZone(ctx, { minX: 11, maxX: 11, minY: 10, maxY: 10 });

      expect(ctx.deliveries.plan().unassigned[0].reason).toMatch(
        /cercado por zonas de exclusão aérea/,
      );
    });

    it('reporta a ida e volta acima da autonomia', () => {
      const perto = addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
      addOrder(ctx, { x: 18, y: 18, weightKg: 1 });
      ctx.drones.update(perto.id, { state: DroneState.IN_FLIGHT });
      addDrone(ctx, { capacityKg: 10, rangeKm: 12 });

      expect(ctx.deliveries.plan().unassigned[0].reason).toMatch(
        /acima da autonomia dos drones que comportam o peso \(máx 12 km\)/,
      );
    });

    it('contorna a zona e contabiliza o desvio', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
      addOrder(ctx, { x: 6, y: 0 });
      const zone = addZone(ctx, { minX: 1, minY: 0, maxX: 4, maxY: 4 });

      const trip = ctx.deliveries.plan().trips[0];
      const rects = ctx.zones.rects();

      expect(trip.detourKm).toBeGreaterThan(0);
      expect(trip.path.every((p) => !isBlocked(p, rects))).toBe(true);
      expect(zone.name).toBe('Zona 1');
    });
  });

  describe('ordenação da fila', () => {
    it('atende a prioridade alta antes da baixa', () => {
      addDrone(ctx, { capacityKg: 5, rangeKm: 40 });
      addOrder(ctx, { x: 2, y: 0, weightKg: 5, priority: Priority.LOW });
      addOrder(ctx, { x: 3, y: 0, weightKg: 5, priority: Priority.HIGH });

      const trip = ctx.deliveries.plan().trips[0];

      expect(trip.orders).toHaveLength(1);
      expect(trip.orders[0].priority).toBe(Priority.HIGH);
    });

    it('respeita a ordem de chegada dentro da mesma prioridade', () => {
      addDrone(ctx, { capacityKg: 5, rangeKm: 40 });
      const primeiro = addOrder(ctx, {
        x: 8,
        y: 0,
        weightKg: 5,
        priority: Priority.MEDIUM,
      });
      addOrder(ctx, { x: 2, y: 0, weightKg: 5, priority: Priority.MEDIUM });

      const trip = ctx.deliveries.plan().trips[0];

      expect(trip.orders[0].id).toBe(primeiro.id);
    });

    it('ordena as paradas pelo vizinho mais próximo da base', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
      addOrder(ctx, { x: 10, y: 0, weightKg: 1 });
      addOrder(ctx, { x: 2, y: 0, weightKg: 1 });
      addOrder(ctx, { x: 6, y: 0, weightKg: 1 });

      const trip = ctx.deliveries.plan().trips[0];

      expect(trip.route).toEqual([
        { x: 2, y: 0 },
        { x: 6, y: 0 },
        { x: 10, y: 0 },
      ]);
    });
  });

  describe('distribuição entre drones', () => {
    it('dá no máximo uma viagem por drone em cada plano', () => {
      addDrone(ctx, { capacityKg: 5, rangeKm: 60 });
      addDrone(ctx, { capacityKg: 5, rangeKm: 60 });
      for (let i = 1; i <= 6; i += 1)
        addOrder(ctx, { x: i, y: 0, weightKg: 5 });

      const plan = ctx.deliveries.plan();

      expect(plan.trips).toHaveLength(2);
      expect(new Set(plan.trips.map((t) => t.drone.id)).size).toBe(2);
      expect(plan.unassigned).toHaveLength(4);
    });

    it('usa primeiro o drone de maior capacidade', () => {
      const pequeno = addDrone(ctx, { capacityKg: 4, rangeKm: 60 });
      const grande = addDrone(ctx, { capacityKg: 20, rangeKm: 60 });
      addOrder(ctx, { x: 3, y: 0, weightKg: 4 });

      expect(ctx.deliveries.plan().trips[0].drone.id).toBe(grande.id);
      expect(pequeno.state).toBe(DroneState.IDLE);
    });

    it('não planeja nada quando não há pedidos pendentes', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60 });

      const plan = ctx.deliveries.plan();

      expect(plan.trips).toEqual([]);
      expect(plan.unassigned).toEqual([]);
      expect(plan.totalTimeMinutes).toBe(0);
      expect(plan.makespanMinutes).toBe(0);
      expect(plan.totalDistanceKm).toBe(0);
    });

    it('não altera o estado dos pedidos: planejar é só simular', () => {
      addDrone(ctx, { capacityKg: 10, rangeKm: 60 });
      addOrder(ctx, { x: 3, y: 0 });

      ctx.deliveries.plan();

      expect(ctx.orders.findPending()).toHaveLength(1);
    });
  });
});
