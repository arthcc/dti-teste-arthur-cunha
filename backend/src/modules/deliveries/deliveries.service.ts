import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BATTERY_RESERVE_PERCENT } from '../../common/config/simulation.config';
import { PRIORITY_WEIGHT } from '../../common/enums/priority.enum';
import { Coordinate } from '../../common/interfaces/coordinate.interface';
import { Rect } from '../../common/interfaces/rect.interface';
import { estimateFlight, formatMinutes } from '../../common/utils/flight.util';
import {
  BASE,
  buildRoute,
  distance,
  routeDistance,
  travelDistance,
} from '../../common/utils/geo.util';
import { DronesService } from '../drones/drones.service';
import { Drone } from '../drones/interfaces/drone.interface';
import { OrdersService } from '../orders/orders.service';
import { Order } from '../orders/interfaces/order.interface';
import { ZonesService } from '../zones/zones.service';
import {
  AllocationPlan,
  Trip,
  UnassignedOrder,
} from './interfaces/trip.interface';

@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);

  constructor(
    private readonly dronesService: DronesService,
    private readonly ordersService: OrdersService,
    private readonly zonesService: ZonesService,
  ) {}

  plan(): AllocationPlan {
    const zones = this.zonesService.rects();
    const drones = this.dronesService.findDispatchable();
    const pending = this.sortOrders(this.ordersService.findPending());

    this.logger.debug(
      `Iniciando planejamento: ${pending.length} pedido(s) pendente(s), ` +
        `${drones.length} drone(s) despachável(is), ${zones.length} zona(s) de exclusão`,
    );

    if (drones.length === 0) {
      const reason = this.noDroneReason();
      this.logger.debug(
        `Nenhum drone despachável; ${pending.length} pedido(s) na espera`,
      );
      return this.assemblePlan(
        [],
        pending.map((order) => ({ order, reason })),
      );
    }

    const unassigned: UnassignedOrder[] = [];
    const queue: Order[] = [];

    for (const order of pending) {
      const reason = this.rejectionReason(order, drones, zones);
      if (reason) unassigned.push({ order, reason });
      else queue.push(order);
    }

    if (unassigned.length > 0) {
      this.logger.debug(
        `${unassigned.length} pedido(s) inviável(is) com a frota e as zonas atuais`,
      );
    }

    const sortedDrones = [...drones].sort(
      (a, b) =>
        b.capacityKg - a.capacityKg || b.batteryPercent - a.batteryPercent,
    );

    const trips: Trip[] = [];

    for (const drone of sortedDrones) {
      if (queue.length === 0) break;

      const selected = this.buildTrip(drone, queue, zones);
      if (selected.length === 0) continue;

      for (const o of selected) {
        const i = queue.indexOf(o);
        if (i >= 0) queue.splice(i, 1);
      }

      const trip = this.assembleTrip(drone, selected, zones);
      if (!trip) {
        queue.unshift(...selected);
        continue;
      }

      trips.push(trip);
      this.logger.debug(
        `Viagem planejada para ${drone.name}: ${trip.orders.length} pedido(s), ` +
          `${trip.totalWeightKg.toFixed(2)}kg (${trip.occupancyPercent}%), ` +
          `${trip.totalDistanceKm.toFixed(2)}km, ${formatMinutes(trip.estimate.totalMinutes)}, ` +
          `bateria ${drone.batteryPercent.toFixed(0)}% → ${trip.batteryAfterPercent.toFixed(0)}%`,
      );
    }

    for (const order of queue) {
      unassigned.push({
        order,
        reason:
          'Não coube nas viagens desta rodada. Assim que um drone voltar à base ele entra no próximo plano.',
      });
    }

    const plan = this.assemblePlan(trips, unassigned);
    this.logger.debug(
      `Planejamento concluído: ${plan.trips.length} viagem(ns), ` +
        `${plan.unassigned.length} sem alocação, ` +
        `tempo total ${formatMinutes(plan.totalTimeMinutes)} ` +
        `(makespan ${formatMinutes(plan.makespanMinutes)})`,
    );
    return plan;
  }

  private assemblePlan(
    trips: Trip[],
    unassigned: UnassignedOrder[],
  ): AllocationPlan {
    return {
      trips,
      unassigned,
      totalTimeMinutes: trips.reduce((s, t) => s + t.estimate.totalMinutes, 0),
      makespanMinutes: trips.reduce(
        (max, t) => Math.max(max, t.estimate.totalMinutes),
        0,
      ),
      totalDistanceKm: trips.reduce((s, t) => s + t.totalDistanceKm, 0),
    };
  }

  private noDroneReason(): string {
    const fleet = this.dronesService.findAll();
    if (fleet.length === 0) {
      return 'Nenhum drone cadastrado. Adicione um drone à frota para o planejador montar rotas.';
    }
    const idle = this.dronesService.findAvailable();
    if (idle.length === 0) {
      return 'Todos os drones estão em voo. O pedido entra no próximo plano quando algum voltar à base.';
    }
    return `Os drones na base estão recarregando (abaixo da carga mínima de despacho).`;
  }

  private sortOrders(orders: Order[]): Order[] {
    return [...orders].sort((a, b) => {
      const prio = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (prio !== 0) return prio;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  private rejectionReason(
    order: Order,
    drones: Drone[],
    zones: Rect[],
  ): string | null {
    const roundTrip = routeDistance([order.location], zones);

    if (!Number.isFinite(roundTrip)) {
      const zone = this.zonesService.zoneAt(order.location);
      return zone
        ? `Destino dentro da zona de exclusão "${zone.name}".`
        : 'Sem rota possível: o destino está cercado por zonas de exclusão aérea.';
    }

    const fitsWeight = drones.filter((d) => order.weightKg <= d.capacityKg);
    if (fitsWeight.length === 0) {
      const maxCapacity = Math.max(...drones.map((d) => d.capacityKg));
      return `Pacote de ${order.weightKg} kg acima da capacidade dos drones disponíveis (máx ${maxCapacity} kg).`;
    }

    const reachable = fitsWeight.filter((d) => roundTrip <= d.rangeKm);
    if (reachable.length === 0) {
      const maxRange = Math.max(...fitsWeight.map((d) => d.rangeKm));
      return `Ida e volta de ${roundTrip.toFixed(1)} km acima da autonomia dos drones que comportam o peso (máx ${maxRange} km).`;
    }

    const withBattery = reachable.filter((d) =>
      this.hasBatteryFor(d, roundTrip, 1),
    );
    if (withBattery.length === 0) {
      const best = Math.max(...reachable.map((d) => d.batteryPercent));
      const needed = estimateFlight(roundTrip, 1, reachable[0]).batteryPercent;
      return (
        `A viagem exige ~${needed.toFixed(0)}% de bateria mais ${BATTERY_RESERVE_PERCENT}% de reserva; ` +
        `o drone mais carregado que atende tem ${best.toFixed(0)}%.`
      );
    }

    return null;
  }

  private hasBatteryFor(
    drone: Drone,
    distanceKm: number,
    stops: number,
  ): boolean {
    const cost = estimateFlight(distanceKm, stops, drone).batteryPercent;
    return drone.batteryPercent - cost >= BATTERY_RESERVE_PERCENT;
  }

  private buildTrip(drone: Drone, candidates: Order[], zones: Rect[]): Order[] {
    const selected: Order[] = [];
    let weight = 0;

    for (const order of candidates) {
      if (weight + order.weightKg > drone.capacityKg) continue;

      const trial = this.orderStops([...selected, order], zones);
      const trialDistance = routeDistance(trial, zones);
      if (!Number.isFinite(trialDistance) || trialDistance > drone.rangeKm) {
        continue;
      }
      if (!this.hasBatteryFor(drone, trialDistance, selected.length + 1)) {
        continue;
      }

      selected.push(order);
      weight += order.weightKg;
    }

    return selected;
  }

  private orderStops(orders: Order[], zones: Rect[]): Coordinate[] {
    return this.sortByRoute(orders, zones).map((o) => o.location);
  }

  private assembleTrip(
    drone: Drone,
    orders: Order[],
    zones: Rect[],
  ): Trip | null {
    const orderedOrders = this.sortByRoute(orders, zones);
    const stops = orderedOrders.map((o) => o.location);

    const shape = buildRoute(stops, zones);
    if (!shape) return null;

    const totalWeightKg = orders.reduce((s, o) => s + o.weightKg, 0);
    const estimate = estimateFlight(shape.distanceKm, orders.length, drone);
    const straightLine = this.straightLineDistance(stops);

    return {
      id: randomUUID(),
      drone,
      orders: orderedOrders,
      route: stops,
      path: shape.path,
      totalWeightKg,
      totalDistanceKm: shape.distanceKm,
      detourKm: Math.max(0, shape.distanceKm - straightLine),
      occupancyPercent: Math.round((totalWeightKg / drone.capacityKg) * 100),
      estimate,
      batteryAfterPercent: Math.max(
        0,
        drone.batteryPercent - estimate.batteryPercent,
      ),
    };
  }

  private straightLineDistance(stops: Coordinate[]): number {
    if (stops.length === 0) return 0;
    let total = 0;
    let current = BASE;
    for (const stop of stops) {
      total += distance(current, stop);
      current = stop;
    }
    return total + distance(current, BASE);
  }

  private sortByRoute(orders: Order[], zones: Rect[]): Order[] {
    const remaining = [...orders];
    const ordered: Order[] = [];
    let current: Coordinate = BASE;

    while (remaining.length > 0) {
      let idx = 0;
      let shortest = Infinity;
      remaining.forEach((o, i) => {
        const d = travelDistance(current, o.location, zones);
        if (d < shortest) {
          shortest = d;
          idx = i;
        }
      });
      const next = remaining.splice(idx, 1)[0];
      ordered.push(next);
      current = next.location;
    }

    return ordered;
  }
}
