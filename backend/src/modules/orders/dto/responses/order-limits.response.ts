import { ApiProperty } from '@nestjs/swagger';
import { OrderLimits } from '../../orders.service';

export class OrderLimitsResponse {
  @ApiProperty({ example: 20, description: 'A malha vai de 0 a este valor.' })
  gridSize: number;

  @ApiProperty({ example: 3, description: 'Quantidade de drones cadastrados.' })
  fleetSize: number;

  @ApiProperty({
    example: 10,
    description:
      'Maior capacidade da frota (kg). Pedidos acima disso são recusados. 0 quando a frota está vazia.',
  })
  maxCapacityKg: number;

  @ApiProperty({
    example: 20,
    description: 'Maior autonomia da frota (km).',
  })
  maxRangeKm: number;

  @ApiProperty({
    example: 15,
    description: 'Reserva de bateria preservada no planejamento (%).',
  })
  batteryReservePercent: number;

  static fromDomain(limits: OrderLimits): OrderLimitsResponse {
    const dto = new OrderLimitsResponse();
    dto.gridSize = limits.gridSize;
    dto.fleetSize = limits.fleetSize;
    dto.maxCapacityKg = limits.maxCapacityKg;
    dto.maxRangeKm = limits.maxRangeKm;
    dto.batteryReservePercent = limits.batteryReservePercent;
    return dto;
  }
}
