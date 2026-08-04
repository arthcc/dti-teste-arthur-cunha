import { Priority } from '../../../common/enums/priority.enum';
import { Coordinate } from '../../../common/interfaces/coordinate.interface';

export enum OrderStatus {
  PENDING = 'pending',
  ALLOCATED = 'allocated',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
}

export interface Order {
  id: string;
  location: Coordinate;
  weightKg: number;
  priority: Priority;
  status: OrderStatus;
  createdAt: Date;
  assignedDroneId: string | null;
  deliveredAt: Date | null;
  deliveryMinutes: number | null;
}
