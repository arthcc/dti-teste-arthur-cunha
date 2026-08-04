import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  HOVER_DRAIN_PER_MINUTE,
  LOADING_MINUTES,
  SERVICE_MINUTES_PER_STOP,
  SIM_MINUTES_PER_TICK,
  TICK_MS,
} from '../../common/config/simulation.config';
import { DroneState } from '../../common/enums/drone-state.enum';
import {
  batteryPercentPerKm,
  formatMinutes,
} from '../../common/utils/flight.util';
import { BASE, buildRoute, pointAlongPath } from '../../common/utils/geo.util';
import { DronesService } from '../drones/drones.service';
import { OrdersService } from '../orders/orders.service';
import { ZonesService } from '../zones/zones.service';
import { DeliveriesService } from './deliveries.service';
import { ActiveFlight, FlightPhase } from './interfaces/flight.interface';

export interface SimulationSnapshot {
  running: boolean;
  clockMinutes: number;
  minutesPerTick: number;
  activeFlights: number;
  ordersDelivered: number;
  ordersInTransit: number;
  averageDeliveryMinutes: number | null;
  totalFlightMinutes: number;
}

@Injectable()
export class SimulationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SimulationService.name);
  private readonly flights = new Map<string, ActiveFlight>();

  private timer: NodeJS.Timeout | null = null;
  private running = true;
  private clockMinutes = 0;
  private totalFlightMinutes = 0;

  constructor(
    private readonly dronesService: DronesService,
    private readonly ordersService: OrdersService,
    private readonly zonesService: ZonesService,
    private readonly deliveriesService: DeliveriesService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.logger.log(
      `Simulação iniciada: ${SIM_MINUTES_PER_TICK} min simulados a cada ${TICK_MS}ms`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  snapshot(): SimulationSnapshot {
    const orders = this.ordersService.findAll();
    const delivered = orders.filter((o) => o.deliveryMinutes !== null);
    const inTransit = orders.filter((o) => o.assignedDroneId !== null && !o.deliveredAt);

    return {
      running: this.running,
      clockMinutes: Number(this.clockMinutes.toFixed(1)),
      minutesPerTick: SIM_MINUTES_PER_TICK,
      activeFlights: this.flights.size,
      ordersDelivered: delivered.length,
      ordersInTransit: inTransit.length,
      averageDeliveryMinutes: delivered.length
        ? Number(
            (
              delivered.reduce((s, o) => s + (o.deliveryMinutes ?? 0), 0) /
              delivered.length
            ).toFixed(1),
          )
        : null,
      totalFlightMinutes: Number(this.totalFlightMinutes.toFixed(1)),
    };
  }

  setRunning(running: boolean): SimulationSnapshot {
    this.running = running;
    this.logger.log(`Simulação ${running ? 'retomada' : 'pausada'}`);
    return this.snapshot();
  }

  reset(): SimulationSnapshot {
    this.flights.clear();
    this.clockMinutes = 0;
    this.totalFlightMinutes = 0;
    this.dronesService.resetAll();
    this.ordersService.resetAll();
    this.logger.log('Simulação reiniciada');
    return this.snapshot();
  }

  private tick(): void {
    if (!this.running) return;

    const minutes = SIM_MINUTES_PER_TICK;
    this.clockMinutes += minutes;

    for (const flight of [...this.flights.values()]) {
      this.advanceFlight(flight, minutes);
    }

    this.rechargeIdleDrones(minutes);
    this.dispatchPending();
  }

  private rechargeIdleDrones(minutes: number): void {
    for (const drone of this.dronesService.findAvailable()) {
      if (drone.batteryPercent < 100) {
        this.dronesService.recharge(drone.id, minutes);
      }
    }
  }

  private dispatchPending(): void {
    if (this.ordersService.findPending().length === 0) return;
    if (this.dronesService.findDispatchable().length === 0) return;

    const plan = this.deliveriesService.plan();

    for (const trip of plan.trips) {
      const zones = this.zonesService.rects();
      const shape = buildRoute(trip.route, zones);
      if (!shape) {
        this.logger.warn(
          `Viagem ${trip.id} descartada no despacho: rota ficou inviável`,
        );
        continue;
      }

      let cumulative = 0;
      const stopDistances = shape.legs.slice(0, trip.route.length).map((leg) => {
        cumulative += leg.distanceKm;
        return cumulative;
      });

      const flight: ActiveFlight = {
        tripId: trip.id,
        droneId: trip.drone.id,
        pendingOrderIds: trip.orders.map((o) => o.id),
        path: shape.path,
        stopDistances,
        totalDistanceKm: shape.distanceKm,
        travelledKm: 0,
        phase: FlightPhase.LOADING,
        phaseMinutesLeft: LOADING_MINUTES,
        elapsedMinutes: 0,
        batteryUsedPercent: 0,
      };

      this.flights.set(trip.drone.id, flight);
      this.dronesService.update(trip.drone.id, {
        state: DroneState.LOADING,
        currentTripId: trip.id,
        position: { ...BASE },
      });
      for (const order of trip.orders) {
        this.ordersService.markAllocated(order.id, trip.drone.id);
      }

      this.logger.log(
        `Despachada viagem ${trip.id} para ${trip.drone.name}: ` +
          `${trip.orders.length} entrega(s), ${formatMinutes(trip.estimate.totalMinutes)} previstos`,
      );
    }
  }

  private advanceFlight(flight: ActiveFlight, minutes: number): void {
    const drone = this.dronesService.findById(flight.droneId);
    flight.elapsedMinutes += minutes;
    this.totalFlightMinutes += minutes;

    if (flight.phase === FlightPhase.LOADING) {
      this.drainByTime(flight, minutes);
      flight.phaseMinutesLeft -= minutes;
      if (flight.phaseMinutesLeft <= 0) {
        flight.phase = FlightPhase.CRUISING;
        this.dronesService.update(drone.id, { state: DroneState.IN_FLIGHT });
      }
      this.abortIfBatteryDead(flight);
      return;
    }

    if (flight.phase === FlightPhase.SERVICING) {
      this.drainByTime(flight, minutes);
      flight.phaseMinutesLeft -= minutes;
      if (flight.phaseMinutesLeft <= 0) {
        flight.phase =
          flight.pendingOrderIds.length > 0
            ? FlightPhase.CRUISING
            : FlightPhase.RETURNING;
        this.dronesService.update(drone.id, {
          state:
            flight.pendingOrderIds.length > 0
              ? DroneState.IN_FLIGHT
              : DroneState.RETURNING,
        });
      }
      this.abortIfBatteryDead(flight);
      return;
    }

    const step = (drone.speedKmh / 60) * minutes;
    const before = flight.travelledKm;
    flight.travelledKm = Math.min(
      flight.totalDistanceKm,
      flight.travelledKm + step,
    );
    this.drainByDistance(flight, drone.rangeKm, flight.travelledKm - before);

    this.dronesService.moveTo(
      drone.id,
      pointAlongPath(flight.path, flight.travelledKm),
    );

    if (this.abortIfBatteryDead(flight)) return;

    const nextStopIdx = flight.stopDistances.length - flight.pendingOrderIds.length;
    const nextStopAt = flight.stopDistances[nextStopIdx];
    if (
      flight.pendingOrderIds.length > 0 &&
      nextStopAt !== undefined &&
      flight.travelledKm >= nextStopAt - 1e-9
    ) {
      const orderId = flight.pendingOrderIds.shift();
      if (orderId) {
        this.ordersService.markDelivered(orderId, flight.elapsedMinutes);
        this.dronesService.update(drone.id, {
          state: DroneState.DELIVERING,
          deliveriesCompleted: drone.deliveriesCompleted + 1,
        });
      }
      flight.phase = FlightPhase.SERVICING;
      flight.phaseMinutesLeft = SERVICE_MINUTES_PER_STOP;
      return;
    }

    if (flight.travelledKm >= flight.totalDistanceKm - 1e-9) {
      this.finishFlight(flight, 'concluída');
    }
  }

  private drainByTime(flight: ActiveFlight, minutes: number): void {
    const percent = minutes * HOVER_DRAIN_PER_MINUTE;
    flight.batteryUsedPercent += percent;
    this.dronesService.drain(flight.droneId, percent);
  }

  private drainByDistance(
    flight: ActiveFlight,
    rangeKm: number,
    km: number,
  ): void {
    if (km <= 0) return;
    const percent = km * batteryPercentPerKm(rangeKm);
    flight.batteryUsedPercent += percent;
    this.dronesService.drain(flight.droneId, percent);
  }

  private abortIfBatteryDead(flight: ActiveFlight): boolean {
    const drone = this.dronesService.findById(flight.droneId);
    if (drone.batteryPercent > 0) return false;

    this.logger.error(
      `Bateria zerada em voo: ${drone.name} pousou com ` +
        `${flight.pendingOrderIds.length} pedido(s) a bordo`,
    );
    this.finishFlight(flight, 'abortada por bateria');
    return true;
  }

  private finishFlight(flight: ActiveFlight, outcome: string): void {
    for (const orderId of flight.pendingOrderIds) {
      this.ordersService.releaseToQueue(orderId);
    }

    const drone = this.dronesService.findById(flight.droneId);
    this.dronesService.update(drone.id, {
      state: DroneState.IDLE,
      position: { ...BASE },
      currentTripId: null,
    });
    this.flights.delete(flight.droneId);

    this.logger.log(
      `Viagem ${flight.tripId} ${outcome}: ${formatMinutes(flight.elapsedMinutes)}, ` +
        `${flight.batteryUsedPercent.toFixed(0)}% de bateria, ` +
        `${drone.name} de volta na base com ${drone.batteryPercent.toFixed(0)}%`,
    );
  }
}
