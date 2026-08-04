import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  DEFAULT_SPEED_KMH,
  MIN_DISPATCH_BATTERY_PERCENT,
  RECHARGE_PERCENT_PER_MINUTE,
} from '../../common/config/simulation.config';
import { DroneState } from '../../common/enums/drone-state.enum';
import { Coordinate } from '../../common/interfaces/coordinate.interface';
import { clampBattery } from '../../common/utils/flight.util';
import { BASE } from '../../common/utils/geo.util';
import { CreateDroneForm } from './dto/forms/create-drone.form';
import { Drone } from './interfaces/drone.interface';

@Injectable()
export class DronesService {
  private readonly logger = new Logger(DronesService.name);
  private readonly drones = new Map<string, Drone>();
  private counter = 0;

  create(form: CreateDroneForm): Drone {
    const id = randomUUID();
    this.counter += 1;
    const drone: Drone = {
      id,
      name: form.name?.trim() || `Drone ${this.counter}`,
      capacityKg: form.capacityKg,
      rangeKm: form.rangeKm,
      speedKmh: form.speedKmh ?? DEFAULT_SPEED_KMH,
      state: DroneState.IDLE,
      position: { ...BASE },
      batteryPercent: 100,
      currentTripId: null,
      deliveriesCompleted: 0,
    };
    this.drones.set(id, drone);
    this.logger.log(
      `Drone cadastrado: ${drone.name} (${id}) capacidade=${drone.capacityKg}kg ` +
        `alcance=${drone.rangeKm}km velocidade=${drone.speedKmh}km/h`,
    );
    return drone;
  }

  findAll(): Drone[] {
    return [...this.drones.values()];
  }

  findAvailable(): Drone[] {
    return this.findAll().filter((d) => d.state === DroneState.IDLE);
  }

  findDispatchable(): Drone[] {
    return this.findAvailable().filter(
      (d) => d.batteryPercent >= MIN_DISPATCH_BATTERY_PERCENT,
    );
  }

  findById(id: string): Drone {
    const drone = this.drones.get(id);
    if (!drone) {
      this.logger.warn(`Drone não encontrado: ${id}`);
      throw new NotFoundException(`Drone ${id} não encontrado`);
    }
    return drone;
  }

  maxCapacity(): number {
    return this.findAll().reduce((max, d) => Math.max(max, d.capacityKg), 0);
  }

  maxRange(): number {
    return this.findAll().reduce((max, d) => Math.max(max, d.rangeKm), 0);
  }

  update(
    id: string,
    patch: Partial<
      Pick<
        Drone,
        | 'state'
        | 'position'
        | 'batteryPercent'
        | 'currentTripId'
        | 'deliveriesCompleted'
      >
    >,
  ): Drone {
    const drone = this.findById(id);
    if (patch.state !== undefined) drone.state = patch.state;
    if (patch.position !== undefined) drone.position = { ...patch.position };
    if (patch.batteryPercent !== undefined) {
      drone.batteryPercent = clampBattery(patch.batteryPercent);
    }
    if (patch.currentTripId !== undefined) {
      drone.currentTripId = patch.currentTripId;
    }
    if (patch.deliveriesCompleted !== undefined) {
      drone.deliveriesCompleted = patch.deliveriesCompleted;
    }
    return drone;
  }

  drain(id: string, percent: number): number {
    const drone = this.findById(id);
    drone.batteryPercent = clampBattery(drone.batteryPercent - percent);
    return drone.batteryPercent;
  }

  recharge(id: string, minutes: number): number {
    const drone = this.findById(id);
    drone.batteryPercent = clampBattery(
      drone.batteryPercent + minutes * RECHARGE_PERCENT_PER_MINUTE,
    );
    return drone.batteryPercent;
  }

  moveTo(id: string, position: Coordinate): void {
    this.findById(id).position = { ...position };
  }

  resetAll(): void {
    for (const drone of this.findAll()) {
      drone.state = DroneState.IDLE;
      drone.position = { ...BASE };
      drone.batteryPercent = 100;
      drone.currentTripId = null;
      drone.deliveriesCompleted = 0;
    }
    this.logger.log('Frota reiniciada: todos na base com bateria cheia');
  }
}
