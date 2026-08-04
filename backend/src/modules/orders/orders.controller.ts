import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CreateOrderForm } from './dto/forms/create-order.form';
import { OrderLimitsResponse } from './dto/responses/order-limits.response';
import { OrderResponse } from './dto/responses/order.response';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Registra um novo pedido de entrega.' })
  @ApiCreatedResponse({ type: OrderResponse })
  @ApiUnprocessableEntityResponse({
    description:
      'Pacote acima da capacidade da frota, destino dentro de zona de exclusão ou fora do alcance.',
  })
  create(@Body() form: CreateOrderForm): OrderResponse {
    return OrderResponse.fromDomain(this.ordersService.create(form));
  }

  @Get()
  @ApiOperation({ summary: 'Lista todos os pedidos registrados.' })
  @ApiOkResponse({ type: OrderResponse, isArray: true })
  findAll(): OrderResponse[] {
    return this.ordersService.findAll().map(OrderResponse.fromDomain);
  }

  @Get('limits')
  @ApiOperation({
    summary:
      'Limites vigentes (malha, capacidade e alcance da frota) para o front validar antes de enviar.',
  })
  @ApiOkResponse({ type: OrderLimitsResponse })
  limits(): OrderLimitsResponse {
    return OrderLimitsResponse.fromDomain(this.ordersService.limits());
  }
}
