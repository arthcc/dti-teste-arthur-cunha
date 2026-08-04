import { ApiProperty } from '@nestjs/swagger';
import { CoordinateResponse } from '../../../drones/dto/responses/coordinate.response';
import { OrderResponse } from '../../../orders/dto/responses/order.response';
import { Trip } from '../../interfaces/trip.interface';

export class TripResponse {
  @ApiProperty({ example: 'f1e2d3', description: 'ID da viagem planejada.' })
  id: string;

  @ApiProperty({
    example: 'a1b2c3',
    description: 'ID do drone que fará a viagem.',
  })
  droneId: string;

  @ApiProperty({ example: 'Drone Alpha' })
  droneName: string;

  @ApiProperty({ example: 8.5, description: 'Peso total transportado (kg).' })
  totalWeightKg: number;

  @ApiProperty({
    example: 34.2,
    description: 'Distância da rota fechada (km), já contando os desvios.',
  })
  totalDistanceKm: number;

  @ApiProperty({
    example: 4.6,
    description:
      'Quilômetros a mais causados pelos desvios das zonas de exclusão.',
  })
  detourKm: number;

  @ApiProperty({
    example: 85,
    description: 'Ocupação da capacidade do drone (%).',
  })
  occupancyPercent: number;

  @ApiProperty({
    example: 56.3,
    description: 'Tempo total da viagem: carregamento + voo + entregas (min).',
  })
  totalMinutes: number;

  @ApiProperty({ example: 45.3, description: 'Tempo apenas de voo (min).' })
  flightMinutes: number;

  @ApiProperty({
    example: 8,
    description: 'Tempo parado nos clientes efetuando as entregas (min).',
  })
  serviceMinutes: number;

  @ApiProperty({
    example: 3,
    description: 'Tempo de carregamento na base (min).',
  })
  loadingMinutes: number;

  @ApiProperty({
    example: 62.4,
    description: 'Bateria consumida pela viagem (pontos percentuais).',
  })
  batteryCostPercent: number;

  @ApiProperty({
    example: 37.6,
    description: 'Bateria prevista quando o drone voltar à base (%).',
  })
  batteryAfterPercent: number;

  @ApiProperty({
    type: CoordinateResponse,
    isArray: true,
    description: 'Paradas na ordem de entrega (sem a base).',
  })
  route: CoordinateResponse[];

  @ApiProperty({
    type: CoordinateResponse,
    isArray: true,
    description:
      'Polilinha completa base → paradas → base, com os vértices dos desvios. É o traçado a ser desenhado no mapa.',
  })
  path: CoordinateResponse[];

  @ApiProperty({
    type: OrderResponse,
    isArray: true,
    description: 'Pedidos da viagem, na ordem de entrega.',
  })
  orders: OrderResponse[];

  static fromDomain(trip: Trip): TripResponse {
    const dto = new TripResponse();
    dto.id = trip.id;
    dto.droneId = trip.drone.id;
    dto.droneName = trip.drone.name;
    dto.totalWeightKg = Number(trip.totalWeightKg.toFixed(2));
    dto.totalDistanceKm = Number(trip.totalDistanceKm.toFixed(2));
    dto.detourKm = Number(trip.detourKm.toFixed(2));
    dto.occupancyPercent = trip.occupancyPercent;
    dto.totalMinutes = Number(trip.estimate.totalMinutes.toFixed(1));
    dto.flightMinutes = Number(trip.estimate.flightMinutes.toFixed(1));
    dto.serviceMinutes = Number(trip.estimate.serviceMinutes.toFixed(1));
    dto.loadingMinutes = Number(trip.estimate.loadingMinutes.toFixed(1));
    dto.batteryCostPercent = Number(trip.estimate.batteryPercent.toFixed(1));
    dto.batteryAfterPercent = Number(trip.batteryAfterPercent.toFixed(1));
    dto.route = trip.route.map((p) => ({ x: p.x, y: p.y }));
    dto.path = trip.path.map((p) => ({ x: p.x, y: p.y }));
    dto.orders = trip.orders.map(OrderResponse.fromDomain);
    return dto;
  }
}
