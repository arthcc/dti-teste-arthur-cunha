import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  DEFAULT_SPEED_KMH,
  MIN_DISPATCH_BATTERY_PERCENT,
  RECHARGE_PERCENT_PER_MINUTE,
} from '../../common/config/simulation.config';
import { DroneState } from '../../common/enums/drone-state.enum';
import { BASE } from '../../common/utils/geo.util';
import { DronesService } from './drones.service';

describe('DronesService', () => {
  let service: DronesService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [DronesService],
    }).compile();

    service = moduleRef.get(DronesService);
  });

  describe('create', () => {
    it('nasce ocioso, na base e com bateria cheia', () => {
      const drone = service.create({ capacityKg: 10, rangeKm: 20 });

      expect(drone).toMatchObject({
        capacityKg: 10,
        rangeKm: 20,
        speedKmh: DEFAULT_SPEED_KMH,
        state: DroneState.IDLE,
        batteryPercent: 100,
        currentTripId: null,
        deliveriesCompleted: 0,
      });
      expect(drone.position).toEqual(BASE);
    });

    it('respeita a velocidade informada', () => {
      const drone = service.create({
        capacityKg: 10,
        rangeKm: 20,
        speedKmh: 90,
      });

      expect(drone.speedKmh).toBe(90);
    });

    it('gera um nome sequencial quando nenhum é informado', () => {
      const primeiro = service.create({ capacityKg: 5, rangeKm: 10 });
      const segundo = service.create({
        name: '  ',
        capacityKg: 5,
        rangeKm: 10,
      });
      const terceiro = service.create({
        name: '  Falcon  ',
        capacityKg: 5,
        rangeKm: 10,
      });

      expect(primeiro.name).toBe('Drone 1');
      expect(segundo.name).toBe('Drone 2');
      expect(terceiro.name).toBe('Falcon');
    });
  });

  describe('disponibilidade', () => {
    it('considera disponível apenas quem está ocioso', () => {
      const parado = service.create({ capacityKg: 10, rangeKm: 20 });
      const voando = service.create({ capacityKg: 10, rangeKm: 20 });
      service.update(voando.id, { state: DroneState.IN_FLIGHT });

      expect(service.findAvailable().map((d) => d.id)).toEqual([parado.id]);
    });

    it('só despacha quem tem carga acima do mínimo', () => {
      const cheio = service.create({ capacityKg: 10, rangeKm: 20 });
      const noLimite = service.create({ capacityKg: 10, rangeKm: 20 });
      const fraco = service.create({ capacityKg: 10, rangeKm: 20 });
      service.update(noLimite.id, {
        batteryPercent: MIN_DISPATCH_BATTERY_PERCENT,
      });
      service.update(fraco.id, {
        batteryPercent: MIN_DISPATCH_BATTERY_PERCENT - 0.1,
      });

      expect(service.findDispatchable().map((d) => d.id)).toEqual([
        cheio.id,
        noLimite.id,
      ]);
      expect(service.findAvailable()).toHaveLength(3);
    });
  });

  describe('maxCapacity / maxRange', () => {
    it('são zero com a frota vazia', () => {
      expect(service.maxCapacity()).toBe(0);
      expect(service.maxRange()).toBe(0);
    });

    it('refletem o maior drone cadastrado', () => {
      service.create({ capacityKg: 5, rangeKm: 40 });
      service.create({ capacityKg: 12, rangeKm: 15 });

      expect(service.maxCapacity()).toBe(12);
      expect(service.maxRange()).toBe(40);
    });
  });

  describe('bateria', () => {
    it('drena sem passar de zero', () => {
      const drone = service.create({ capacityKg: 10, rangeKm: 20 });

      expect(service.drain(drone.id, 30)).toBe(70);
      expect(service.drain(drone.id, 200)).toBe(0);
    });

    it('recarrega pela taxa configurada, sem passar de 100', () => {
      const drone = service.create({ capacityKg: 10, rangeKm: 20 });
      service.update(drone.id, { batteryPercent: 50 });

      expect(service.recharge(drone.id, 2)).toBeCloseTo(
        50 + 2 * RECHARGE_PERCENT_PER_MINUTE,
        6,
      );
      expect(service.recharge(drone.id, 100)).toBe(100);
    });

    it('limita a carga no update', () => {
      const drone = service.create({ capacityKg: 10, rangeKm: 20 });

      expect(
        service.update(drone.id, { batteryPercent: 130 }).batteryPercent,
      ).toBe(100);
      expect(
        service.update(drone.id, { batteryPercent: -20 }).batteryPercent,
      ).toBe(0);
    });
  });

  describe('update / moveTo', () => {
    it('aplica só os campos informados', () => {
      const drone = service.create({ capacityKg: 10, rangeKm: 20 });

      service.update(drone.id, {
        state: DroneState.DELIVERING,
        deliveriesCompleted: 4,
      });

      expect(drone.state).toBe(DroneState.DELIVERING);
      expect(drone.deliveriesCompleted).toBe(4);
      expect(drone.batteryPercent).toBe(100);
    });

    it('copia a posição em vez de guardar a referência', () => {
      const drone = service.create({ capacityKg: 10, rangeKm: 20 });
      const alvo = { x: 3, y: 7 };

      service.moveTo(drone.id, alvo);
      alvo.x = 99;

      expect(drone.position).toEqual({ x: 3, y: 7 });
    });
  });

  describe('findById', () => {
    it('falha para um id inexistente', () => {
      expect(() => service.findById('nao-existe')).toThrow(NotFoundException);
    });
  });

  describe('resetAll', () => {
    it('devolve todo mundo à base com carga cheia', () => {
      const drone = service.create({ capacityKg: 10, rangeKm: 20 });
      service.update(drone.id, {
        state: DroneState.RETURNING,
        position: { x: 9, y: 9 },
        batteryPercent: 12,
        currentTripId: 'trip-1',
        deliveriesCompleted: 7,
      });

      service.resetAll();

      expect(drone).toMatchObject({
        state: DroneState.IDLE,
        batteryPercent: 100,
        currentTripId: null,
        deliveriesCompleted: 0,
      });
      expect(drone.position).toEqual(BASE);
    });
  });
});
