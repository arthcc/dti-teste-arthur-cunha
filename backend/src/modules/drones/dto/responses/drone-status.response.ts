import { ApiProperty } from '@nestjs/swagger';
import { MIN_DISPATCH_BATTERY_PERCENT } from '../../../../common/config/simulation.config';
import { DroneState } from '../../../../common/enums/drone-state.enum';
import { Drone } from '../../interfaces/drone.interface';
import { CoordinateResponse } from './coordinate.response';

export class DroneStatusResponse {
  @ApiProperty({ example: 'a1b2c3' })
  id: string;

  @ApiProperty({ example: 'Drone Alpha' })
  name: string;

  @ApiProperty({
    enum: DroneState,
    example: DroneState.IDLE,
    description: 'Estado atual no ciclo de simulação.',
  })
  state: DroneState;

  @ApiProperty({
    example: true,
    description: 'Se o drone está livre (IDLE) para receber uma nova viagem.',
  })
  available: boolean;

  @ApiProperty({
    example: true,
    description: `Se além de livre tem carga suficiente (>= ${MIN_DISPATCH_BATTERY_PERCENT}%) para ser despachado.`,
  })
  dispatchable: boolean;

  @ApiProperty({ example: 10 })
  capacityKg: number;

  @ApiProperty({ example: 20 })
  rangeKm: number;

  @ApiProperty({ example: 40, description: 'Velocidade de cruzeiro em km/h.' })
  speedKmh: number;

  @ApiProperty({ example: 87.5, description: 'Carga restante da bateria (%).' })
  batteryPercent: number;

  @ApiProperty({
    example: 17.5,
    description: 'Alcance restante com a carga atual, em km.',
  })
  remainingRangeKm: number;

  @ApiProperty({
    example: 3,
    description: 'Entregas concluídas desde a entrada na frota.',
  })
  deliveriesCompleted: number;

  @ApiProperty({ type: CoordinateResponse })
  position: CoordinateResponse;

  static fromDomain(drone: Drone): DroneStatusResponse {
    const dto = new DroneStatusResponse();
    dto.id = drone.id;
    dto.name = drone.name;
    dto.state = drone.state;
    dto.available = drone.state === DroneState.IDLE;
    dto.dispatchable =
      dto.available && drone.batteryPercent >= MIN_DISPATCH_BATTERY_PERCENT;
    dto.capacityKg = drone.capacityKg;
    dto.rangeKm = drone.rangeKm;
    dto.speedKmh = drone.speedKmh;
    dto.batteryPercent = Number(drone.batteryPercent.toFixed(1));
    dto.remainingRangeKm = Number(
      ((drone.batteryPercent / 100) * drone.rangeKm).toFixed(2),
    );
    dto.deliveriesCompleted = drone.deliveriesCompleted;
    dto.position = {
      x: Number(drone.position.x.toFixed(2)),
      y: Number(drone.position.y.toFixed(2)),
    };
    return dto;
  }
}
