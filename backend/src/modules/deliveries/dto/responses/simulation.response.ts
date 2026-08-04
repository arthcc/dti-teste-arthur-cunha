import { ApiProperty } from '@nestjs/swagger';
import { SimulationSnapshot } from '../../simulation.service';

export class SimulationResponse {
  @ApiProperty({ example: true, description: 'Se o relógio está avançando.' })
  running: boolean;

  @ApiProperty({ example: 128.5, description: 'Minutos simulados desde o início.' })
  clockMinutes: number;

  @ApiProperty({
    example: 0.5,
    description: 'Minutos simulados que avançam a cada tick real.',
  })
  minutesPerTick: number;

  @ApiProperty({ example: 2, description: 'Viagens no ar neste momento.' })
  activeFlights: number;

  @ApiProperty({ example: 7, description: 'Pedidos já entregues.' })
  ordersDelivered: number;

  @ApiProperty({ example: 3, description: 'Pedidos a bordo de algum drone.' })
  ordersInTransit: number;

  @ApiProperty({
    example: 21.4,
    nullable: true,
    description:
      'Tempo médio de entrega dos pedidos concluídos (min). Nulo enquanto não houver entregas.',
  })
  averageDeliveryMinutes: number | null;

  @ApiProperty({
    example: 340.5,
    description: 'Tempo total acumulado de voo da frota (min).',
  })
  totalFlightMinutes: number;

  static fromDomain(snapshot: SimulationSnapshot): SimulationResponse {
    const dto = new SimulationResponse();
    dto.running = snapshot.running;
    dto.clockMinutes = snapshot.clockMinutes;
    dto.minutesPerTick = snapshot.minutesPerTick;
    dto.activeFlights = snapshot.activeFlights;
    dto.ordersDelivered = snapshot.ordersDelivered;
    dto.ordersInTransit = snapshot.ordersInTransit;
    dto.averageDeliveryMinutes = snapshot.averageDeliveryMinutes;
    dto.totalFlightMinutes = snapshot.totalFlightMinutes;
    return dto;
  }
}
