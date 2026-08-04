import { ApiProperty } from '@nestjs/swagger';
import { OrderResponse } from '../../../orders/dto/responses/order.response';
import { AllocationPlan } from '../../interfaces/trip.interface';
import { TripResponse } from './trip.response';
import { UnassignedResponse } from './unassigned.response';

export class RouteResponse {
  @ApiProperty({ example: 2, description: 'Quantidade de viagens planejadas.' })
  totalTrips: number;

  @ApiProperty({
    example: 5,
    description: 'Total de pedidos alocados em viagens.',
  })
  totalAssignedOrders: number;

  @ApiProperty({
    example: 78.4,
    description: 'Distância navegável somada de todas as viagens (km).',
  })
  totalDistanceKm: number;

  @ApiProperty({
    example: 112.6,
    description:
      'Tempo total de entrega: soma das viagens, ou seja, a carga de trabalho da frota (min).',
  })
  totalTimeMinutes: number;

  @ApiProperty({
    example: 61.2,
    description:
      'Tempo até a última entrega com os drones voando em paralelo (min).',
  })
  makespanMinutes: number;

  @ApiProperty({ type: TripResponse, isArray: true })
  trips: TripResponse[];

  @ApiProperty({
    type: UnassignedResponse,
    isArray: true,
    description: 'Pedidos que ficaram fora do plano, cada um com o motivo.',
  })
  unassigned: UnassignedResponse[];

  static fromDomain(plan: AllocationPlan): RouteResponse {
    const dto = new RouteResponse();
    dto.trips = plan.trips.map(TripResponse.fromDomain);
    dto.totalTrips = dto.trips.length;
    dto.totalAssignedOrders = plan.trips.reduce(
      (s, t) => s + t.orders.length,
      0,
    );
    dto.totalDistanceKm = Number(plan.totalDistanceKm.toFixed(2));
    dto.totalTimeMinutes = Number(plan.totalTimeMinutes.toFixed(1));
    dto.makespanMinutes = Number(plan.makespanMinutes.toFixed(1));
    dto.unassigned = plan.unassigned.map((u) => {
      const item = new UnassignedResponse();
      item.order = OrderResponse.fromDomain(u.order);
      item.reason = u.reason;
      return item;
    });
    return dto;
  }
}
