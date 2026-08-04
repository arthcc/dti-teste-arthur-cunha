import { ApiProperty } from '@nestjs/swagger';
import { DroneState } from '../../../../common/enums/drone-state.enum';
import { Drone } from '../../interfaces/drone.interface';
import { CoordinateResponse } from './coordinate.response';

export class DroneResponse {
  @ApiProperty({ example: 'a1b2c3', description: 'Identificador único do drone.' })
  id: string;

  @ApiProperty({ example: 'Drone Alpha' })
  name: string;

  @ApiProperty({ example: 10, description: 'Capacidade máxima em kg.' })
  capacityKg: number;

  @ApiProperty({ example: 20, description: 'Autonomia com bateria cheia, em km.' })
  rangeKm: number;

  @ApiProperty({ example: 40, description: 'Velocidade de cruzeiro em km/h.' })
  speedKmh: number;

  @ApiProperty({
    enum: DroneState,
    example: DroneState.IDLE,
    description: 'Estado atual do drone no ciclo de simulação.',
  })
  state: DroneState;

  @ApiProperty({ type: CoordinateResponse, description: 'Posição atual na malha.' })
  position: CoordinateResponse;

  @ApiProperty({ example: 87.5, description: 'Carga restante da bateria (%).' })
  batteryPercent: number;

  @ApiProperty({
    example: 3,
    description: 'Entregas concluídas desde a entrada na frota.',
  })
  deliveriesCompleted: number;

  static fromDomain(drone: Drone): DroneResponse {
    const dto = new DroneResponse();
    dto.id = drone.id;
    dto.name = drone.name;
    dto.capacityKg = drone.capacityKg;
    dto.rangeKm = drone.rangeKm;
    dto.speedKmh = drone.speedKmh;
    dto.state = drone.state;
    dto.position = {
      x: Number(drone.position.x.toFixed(2)),
      y: Number(drone.position.y.toFixed(2)),
    };
    dto.batteryPercent = Number(drone.batteryPercent.toFixed(1));
    dto.deliveriesCompleted = drone.deliveriesCompleted;
    return dto;
  }
}
