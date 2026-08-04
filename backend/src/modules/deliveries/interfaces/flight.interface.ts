import { Coordinate } from '../../../common/interfaces/coordinate.interface';

export enum FlightPhase {
  LOADING = 'loading',
  CRUISING = 'cruising',
  SERVICING = 'servicing',
  RETURNING = 'returning',
}

export interface ActiveFlight {
  tripId: string;
  droneId: string;
  pendingOrderIds: string[];
  path: Coordinate[];
  stopDistances: number[];
  totalDistanceKm: number;
  travelledKm: number;
  phase: FlightPhase;
  phaseMinutesLeft: number;
  elapsedMinutes: number;
  batteryUsedPercent: number;
}
