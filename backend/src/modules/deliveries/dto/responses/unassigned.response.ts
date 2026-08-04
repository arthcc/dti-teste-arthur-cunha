import { ApiProperty } from '@nestjs/swagger';
import { OrderResponse } from '../../../orders/dto/responses/order.response';

export class UnassignedResponse {
  @ApiProperty({ type: OrderResponse })
  order: OrderResponse;

  @ApiProperty({
    example:
      'Pacote de 12 kg acima da capacidade dos drones disponíveis (máx 10 kg).',
    description: 'Motivo pelo qual o pedido não entrou em nenhuma viagem.',
  })
  reason: string;
}
