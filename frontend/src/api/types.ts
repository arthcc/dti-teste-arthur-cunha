export type Priority = 'baixa' | 'media' | 'alta';

export type DroneState =
  | 'idle'
  | 'loading'
  | 'in_flight'
  | 'delivering'
  | 'returning';

export type OrderStatus = 'pending' | 'allocated' | 'in_transit' | 'delivered';

export interface Coordinate {
  x: number;
  y: number;
}

export interface Drone {
  id: string;
  name: string;
  capacityKg: number;
  rangeKm: number;
  speedKmh: number;
  state: DroneState;
  position: Coordinate;
  batteryPercent: number;
  deliveriesCompleted: number;
}

export interface DroneStatus extends Drone {
  available: boolean;
  dispatchable: boolean;
  remainingRangeKm: number;
}

export interface Order {
  id: string;
  location: Coordinate;
  weightKg: number;
  priority: Priority;
  status: OrderStatus;
  createdAt: string;
  assignedDroneId: string | null;
  deliveryMinutes: number | null;
}

export interface Trip {
  id: string;
  droneId: string;
  droneName: string;
  totalWeightKg: number;
  totalDistanceKm: number;
  detourKm: number;
  occupancyPercent: number;
  totalMinutes: number;
  flightMinutes: number;
  serviceMinutes: number;
  loadingMinutes: number;
  batteryCostPercent: number;
  batteryAfterPercent: number;
  route: Coordinate[];
  path: Coordinate[];
  orders: Order[];
}

export interface UnassignedEntry {
  order: Order;
  reason: string;
}

export interface RoutePlan {
  totalTrips: number;
  totalAssignedOrders: number;
  totalDistanceKm: number;
  totalTimeMinutes: number;
  makespanMinutes: number;
  trips: Trip[];
  unassigned: UnassignedEntry[];
}

export interface NoFlyZone {
  id: string;
  name: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  blockedPoints: number;
  createdAt: string;
}

export interface SimulationState {
  running: boolean;
  clockMinutes: number;
  minutesPerTick: number;
  activeFlights: number;
  ordersDelivered: number;
  ordersInTransit: number;
  averageDeliveryMinutes: number | null;
  totalFlightMinutes: number;
}

export interface OrderLimits {
  gridSize: number;
  fleetSize: number;
  maxCapacityKg: number;
  maxRangeKm: number;
  batteryReservePercent: number;
}

export interface CreateOrderInput {
  location: Coordinate;
  weightKg: number;
  priority: Priority;
}

export interface CreateDroneInput {
  name?: string;
  capacityKg: number;
  rangeKm: number;
  speedKmh?: number;
}

export interface CreateZoneInput {
  name?: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
