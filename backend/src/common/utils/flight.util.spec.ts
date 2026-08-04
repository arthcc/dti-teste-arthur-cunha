import {
  HOVER_DRAIN_PER_MINUTE,
  LOADING_MINUTES,
  SERVICE_MINUTES_PER_STOP,
} from '../config/simulation.config';
import {
  batteryPercentPerKm,
  clampBattery,
  estimateFlight,
  flightMinutes,
  formatMinutes,
} from './flight.util';

const DRONE = { rangeKm: 20, speedKmh: 40 };

describe('flight.util', () => {
  describe('batteryPercentPerKm', () => {
    it('divide a carga cheia pela autonomia declarada', () => {
      expect(batteryPercentPerKm(20)).toBe(5);
      expect(batteryPercentPerKm(50)).toBe(2);
    });

    it('é infinito para autonomia zero ou negativa', () => {
      expect(batteryPercentPerKm(0)).toBe(Infinity);
      expect(batteryPercentPerKm(-10)).toBe(Infinity);
    });
  });

  describe('flightMinutes', () => {
    it('converte distância e velocidade em minutos', () => {
      expect(flightMinutes(20, 40)).toBe(30);
      expect(flightMinutes(0, 40)).toBe(0);
    });

    it('é infinito quando a velocidade não é positiva', () => {
      expect(flightMinutes(10, 0)).toBe(Infinity);
      expect(flightMinutes(10, -5)).toBe(Infinity);
    });
  });

  describe('estimateFlight', () => {
    it('soma voo, entregas e carregamento', () => {
      const cost = estimateFlight(10, 2, DRONE);

      expect(cost.flightMinutes).toBeCloseTo(15, 6);
      expect(cost.serviceMinutes).toBe(2 * SERVICE_MINUTES_PER_STOP);
      expect(cost.loadingMinutes).toBe(LOADING_MINUTES);
      expect(cost.totalMinutes).toBeCloseTo(15 + 4 + LOADING_MINUTES, 6);
    });

    it('cobra bateria por distância e por tempo de motor ligado', () => {
      const cost = estimateFlight(10, 2, DRONE);
      const ground = 2 * SERVICE_MINUTES_PER_STOP + LOADING_MINUTES;

      expect(cost.batteryPercent).toBeCloseTo(
        10 * 5 + ground * HOVER_DRAIN_PER_MINUTE,
        6,
      );
    });

    it('não cobra carregamento quando não há paradas', () => {
      const cost = estimateFlight(0, 0, DRONE);

      expect(cost.loadingMinutes).toBe(0);
      expect(cost.totalMinutes).toBe(0);
      expect(cost.batteryPercent).toBe(0);
    });

    it('cresce de forma monotônica com a distância', () => {
      const curto = estimateFlight(5, 1, DRONE);
      const longo = estimateFlight(15, 1, DRONE);

      expect(longo.batteryPercent).toBeGreaterThan(curto.batteryPercent);
      expect(longo.totalMinutes).toBeGreaterThan(curto.totalMinutes);
    });
  });

  describe('clampBattery', () => {
    it('mantém a carga entre 0 e 100', () => {
      expect(clampBattery(-5)).toBe(0);
      expect(clampBattery(150)).toBe(100);
      expect(clampBattery(42.5)).toBe(42.5);
    });
  });

  describe('formatMinutes', () => {
    it('usa apenas minutos abaixo de uma hora', () => {
      expect(formatMinutes(42)).toBe('42min');
      expect(formatMinutes(0)).toBe('0min');
    });

    it('quebra em horas e minutos', () => {
      expect(formatMinutes(84)).toBe('1h 24min');
    });

    it('omite os minutos quando a hora é cheia', () => {
      expect(formatMinutes(120)).toBe('2h');
      expect(formatMinutes(59.6)).toBe('1h');
    });
  });
});
