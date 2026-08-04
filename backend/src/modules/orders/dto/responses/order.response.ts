import { ApiProperty } from '@nestjs/swagger';
import { Priority } from '../../../../common/enums/priority.enum';
import { CoordinateResponse } from '../../../drones/dto/responses/coordinate.response';
import { Order, OrderStatus } from '../../interfaces/order.interface';

export class OrderResponse {
  @ApiProperty({ example: 'a1b2c3' })
  id: string;

  @ApiProperty({ type: CoordinateResponse, description: 'Localização do cliente.' })
  location: CoordinateResponse;

  @ApiProperty({ example: 3.5, description: 'Peso do pacote em kg.' })
  weightKg: number;

  @ApiProperty({ enum: Priority, example: Priority.ALTA })
  priority: Priority;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING })
  status: OrderStatus;

  @ApiProperty({ example: '2026-08-03T14:30:00.000Z' })
  createdAt: string;

  @ApiProperty({
    example: 'a1b2c3',
    nullable: true,
    description: 'Drone responsável, quando o pedido já foi alocado.',
  })
  assignedDroneId: string | null;

  @ApiProperty({
    example: 18.4,
    nullable: true,
    description: 'Minutos entre o registro e a entrega, quando concluída.',
  })
  deliveryMinutes: number | null;

  static fromDomain(order: Order): OrderResponse {
    const dto = new OrderResponse();
    dto.id = order.id;
    dto.location = { x: order.location.x, y: order.location.y };
    dto.weightKg = order.weightKg;
    dto.priority = order.priority;
    dto.status = order.status;
    dto.createdAt = order.createdAt.toISOString();
    dto.assignedDroneId = order.assignedDroneId;
    dto.deliveryMinutes = order.deliveryMinutes;
    return dto;
  }
}
