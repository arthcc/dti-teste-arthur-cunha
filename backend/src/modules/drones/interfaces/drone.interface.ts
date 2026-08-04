import { DroneState } from '../../../common/enums/drone-state.enum';
import { Coordinate } from '../../../common/interfaces/coordinate.interface';

export interface Drone {
  id: string;
  name: string;
  capacityKg: number;
  rangeKm: number;
  speedKmh: number;
  state: DroneState;
  position: Coordinate;
  batteryPercent: number;
  currentTripId: string | null;
  deliveriesCompleted: number;
}
