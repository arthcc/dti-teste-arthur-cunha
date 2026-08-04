import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RouteResponse } from './dto/responses/route.response';
import { SimulationResponse } from './dto/responses/simulation.response';
import { DeliveriesService } from './deliveries.service';
import { SimulationService } from './simulation.service';

@ApiTags('deliveries')
@Controller('deliveries')
export class DeliveriesController {
  constructor(
    private readonly deliveriesService: DeliveriesService,
    private readonly simulationService: SimulationService,
  ) {}

  @Get('route')
  @ApiOperation({
    summary:
      'Calcula o plano de entregas: aloca os pedidos pendentes nos drones disponíveis ' +
      'com o menor número de viagens, respeitando capacidade, alcance, bateria e ' +
      'desviando das zonas de exclusão aérea.',
  })
  @ApiOkResponse({ type: RouteResponse })
  route(): RouteResponse {
    return RouteResponse.fromDomain(this.deliveriesService.plan());
  }

  @Get('simulation')
  @ApiOperation({ summary: 'Estado atual do relógio da simulação.' })
  @ApiOkResponse({ type: SimulationResponse })
  simulation(): SimulationResponse {
    return SimulationResponse.fromDomain(this.simulationService.snapshot());
  }

  @Post('simulation/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pausa o avanço do relógio da simulação.' })
  @ApiOkResponse({ type: SimulationResponse })
  pause(): SimulationResponse {
    return SimulationResponse.fromDomain(
      this.simulationService.setRunning(false),
    );
  }

  @Post('simulation/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retoma o avanço do relógio da simulação.' })
  @ApiOkResponse({ type: SimulationResponse })
  resume(): SimulationResponse {
    return SimulationResponse.fromDomain(
      this.simulationService.setRunning(true),
    );
  }

  @Post('simulation/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Reinicia a simulação: frota de volta à base com bateria cheia e pedidos de volta à fila.',
  })
  @ApiOkResponse({ type: SimulationResponse })
  reset(): SimulationResponse {
    return SimulationResponse.fromDomain(this.simulationService.reset());
  }
}
