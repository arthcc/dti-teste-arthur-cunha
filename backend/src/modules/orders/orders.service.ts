import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BATTERY_RESERVE_PERCENT,
  GRID_SIZE,
} from '../../common/config/simulation.config';
import { Coordinate } from '../../common/interfaces/coordinate.interface';
import { routeDistance } from '../../common/utils/geo.util';
import { DronesService } from '../drones/drones.service';
import { ZonesService } from '../zones/zones.service';
import { CreateOrderForm } from './dto/forms/create-order.form';
import { Order, OrderStatus } from './interfaces/order.interface';

export interface OrderLimits {
  gridSize: number;
  fleetSize: number;
  maxCapacityKg: number;
  maxRangeKm: number;
  batteryReservePercent: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly orders = new Map<string, Order>();

  constructor(
    private readonly dronesService: DronesService,
    private readonly zonesService: ZonesService,
  ) {}

  create(form: CreateOrderForm): Order {
    const location: Coordinate = { x: form.location.x, y: form.location.y };

    this.assertOutsideNoFlyZone(location);
    this.assertWithinFleetCapacity(form.weightKg);
    this.assertReachable(location);

    const id = randomUUID();
    const order: Order = {
      id,
      location,
      weightKg: form.weightKg,
      priority: form.priority,
      status: OrderStatus.PENDING,
      createdAt: new Date(),
      assignedDroneId: null,
      deliveredAt: null,
      deliveryMinutes: null,
    };
    this.orders.set(id, order);
    this.logger.log(
      `Pedido registrado: ${id} peso=${order.weightKg}kg prioridade=${order.priority} destino=(${location.x},${location.y})`,
    );
    return order;
  }

  private assertOutsideNoFlyZone(location: Coordinate): void {
    const zone = this.zonesService.zoneAt(location);
    if (zone) {
      this.logger.warn(
        `Pedido recusado: destino (${location.x},${location.y}) dentro da zona "${zone.name}"`,
      );
      throw new UnprocessableEntityException(
        `O destino (${location.x}, ${location.y}) está dentro da zona de exclusão "${zone.name}". Escolha outro ponto.`,
      );
    }
  }

  private assertWithinFleetCapacity(weightKg: number): void {
    const fleetSize = this.dronesService.findAll().length;
    if (fleetSize === 0) return;

    const maxCapacity = this.dronesService.maxCapacity();
    if (weightKg > maxCapacity) {
      this.logger.warn(
        `Pedido recusado: ${weightKg}kg acima da maior capacidade da frota (${maxCapacity}kg)`,
      );
      throw new UnprocessableEntityException(
        `O pacote de ${weightKg} kg excede a capacidade do maior drone da frota (${maxCapacity} kg). ` +
          `Divida a carga ou cadastre um drone com capacidade maior.`,
      );
    }
  }

  private assertReachable(location: Coordinate): void {
    const zones = this.zonesService.rects();
    const roundTrip = routeDistance([location], zones);

    if (!Number.isFinite(roundTrip)) {
      this.logger.warn(
        `Pedido recusado: destino (${location.x},${location.y}) cercado por zonas de exclusão`,
      );
      throw new UnprocessableEntityException(
        `Não há rota possível até (${location.x}, ${location.y}): o ponto está cercado por zonas de exclusão aérea.`,
      );
    }

    const fleetSize = this.dronesService.findAll().length;
    if (fleetSize === 0) return;

    const usableRange =
      this.dronesService.maxRange() * (1 - BATTERY_RESERVE_PERCENT / 100);

    if (roundTrip > usableRange) {
      this.logger.warn(
        `Pedido recusado: ida e volta de ${roundTrip.toFixed(2)}km acima do alcance útil da frota (${usableRange.toFixed(2)}km)`,
      );
      throw new UnprocessableEntityException(
        `A ida e volta até (${location.x}, ${location.y}) dá ${roundTrip.toFixed(1)} km, ` +
          `acima do alcance útil do maior drone (${usableRange.toFixed(1)} km, já descontada a reserva de ${BATTERY_RESERVE_PERCENT}%).`,
      );
    }
  }

  limits(): OrderLimits {
    return {
      gridSize: GRID_SIZE,
      fleetSize: this.dronesService.findAll().length,
      maxCapacityKg: this.dronesService.maxCapacity(),
      maxRangeKm: this.dronesService.maxRange(),
      batteryReservePercent: BATTERY_RESERVE_PERCENT,
    };
  }

  findAll(): Order[] {
    return [...this.orders.values()];
  }

  findPending(): Order[] {
    return this.findAll().filter((o) => o.status === OrderStatus.PENDING);
  }

  findById(id: string): Order {
    const order = this.orders.get(id);
    if (!order) {
      this.logger.warn(`Pedido não encontrado: ${id}`);
      throw new NotFoundException(`Pedido ${id} não encontrado`);
    }
    return order;
  }

  markAllocated(id: string, droneId: string): void {
    const order = this.findById(id);
    order.status = OrderStatus.ALLOCATED;
    order.assignedDroneId = droneId;
  }

  markInTransit(id: string): void {
    this.findById(id).status = OrderStatus.IN_TRANSIT;
  }

  markDelivered(id: string, elapsedMinutes: number): void {
    const order = this.findById(id);
    order.status = OrderStatus.DELIVERED;
    order.deliveredAt = new Date();
    order.deliveryMinutes = Number(elapsedMinutes.toFixed(1));
    this.logger.log(
      `Pedido entregue: ${id} em ${order.deliveryMinutes} min de simulação`,
    );
  }

  releaseToQueue(id: string): void {
    const order = this.findById(id);
    order.status = OrderStatus.PENDING;
    order.assignedDroneId = null;
  }

  resetAll(): void {
    for (const order of this.findAll()) {
      order.status = OrderStatus.PENDING;
      order.assignedDroneId = null;
      order.deliveredAt = null;
      order.deliveryMinutes = null;
    }
    this.logger.log('Pedidos reiniciados: todos de volta para a fila');
  }
}
