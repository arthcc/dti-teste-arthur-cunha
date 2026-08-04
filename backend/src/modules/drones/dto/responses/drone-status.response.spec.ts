import { MIN_DISPATCH_BATTERY_PERCENT } from '../../../../common/config/simulation.config';
import { DroneState } from '../../../../common/enums/drone-state.enum';
import { Drone } from '../../interfaces/drone.interface';
import { DroneStatusResponse } from './drone-status.response';

function drone(overrides: Partial<Drone> = {}): Drone {
  return {
    id: 'a1b2c3',
    name: 'Drone Alpha',
    capacityKg: 10,
    rangeKm: 20,
    speedKmh: 40,
    state: DroneState.IDLE,
    position: { x: 0, y: 0 },
    batteryPercent: 100,
    currentTripId: null,
    deliveriesCompleted: 0,
    ...overrides,
  };
}

describe('DroneStatusResponse', () => {
  it('marca como disponível e despachável quem está ocioso e carregado', () => {
    const dto = DroneStatusResponse.fromDomain(drone());

    expect(dto.available).toBe(true);
    expect(dto.dispatchable).toBe(true);
  });

  it('não é despachável quando está ocioso mas com pouca carga', () => {
    const dto = DroneStatusResponse.fromDomain(
      drone({ batteryPercent: MIN_DISPATCH_BATTERY_PERCENT - 1 }),
    );

    expect(dto.available).toBe(true);
    expect(dto.dispatchable).toBe(false);
  });

  it('não é disponível nem despachável em voo', () => {
    const dto = DroneStatusResponse.fromDomain(
      drone({ state: DroneState.IN_FLIGHT }),
    );

    expect(dto.available).toBe(false);
    expect(dto.dispatchable).toBe(false);
  });

  it('converte a carga em alcance restante', () => {
    const dto = DroneStatusResponse.fromDomain(drone({ batteryPercent: 87.5 }));

    expect(dto.batteryPercent).toBe(87.5);
    expect(dto.remainingRangeKm).toBe(17.5);
  });

  it('arredonda a posição para duas casas', () => {
    const dto = DroneStatusResponse.fromDomain(
      drone({ position: { x: 3.14159, y: 2.71828 } }),
    );

    expect(dto.position).toEqual({ x: 3.14, y: 2.72 });
  });
});
