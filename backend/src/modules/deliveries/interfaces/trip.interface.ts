import { Coordinate } from '../../../common/interfaces/coordinate.interface';
import { FlightCost } from '../../../common/utils/flight.util';
import { Drone } from '../../drones/interfaces/drone.interface';
import { Order } from '../../orders/interfaces/order.interface';

export interface Trip {
  id: string;
  drone: Drone;
  orders: Order[];
  route: Coordinate[];
  path: Coordinate[];
  totalWeightKg: number;
  totalDistanceKm: number;
  detourKm: number;
  occupancyPercent: number;
  estimate: FlightCost;
  batteryAfterPercent: number;
}

export interface UnassignedOrder {
  order: Order;
  reason: string;
}

export interface AllocationPlan {
  trips: Trip[];
  unassigned: UnassignedOrder[];
  totalTimeMinutes: number;
  makespanMinutes: number;
  totalDistanceKm: number;
}
