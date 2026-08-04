import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateDroneForm } from './dto/forms/create-drone.form';
import { DroneResponse } from './dto/responses/drone.response';
import { DroneStatusResponse } from './dto/responses/drone-status.response';
import { DronesService } from './drones.service';

@ApiTags('drones')
@Controller('drones')
export class DronesController {
  constructor(private readonly dronesService: DronesService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra um novo drone na frota.' })
  @ApiCreatedResponse({ type: DroneResponse })
  create(@Body() form: CreateDroneForm): DroneResponse {
    return DroneResponse.fromDomain(this.dronesService.create(form));
  }

  @Get()
  @ApiOperation({ summary: 'Lista todos os drones cadastrados.' })
  @ApiOkResponse({ type: DroneResponse, isArray: true })
  findAll(): DroneResponse[] {
    return this.dronesService.findAll().map(DroneResponse.fromDomain);
  }

  @Get('status')
  @ApiOperation({ summary: 'Retorna o status atual de todos os drones.' })
  @ApiOkResponse({ type: DroneStatusResponse, isArray: true })
  status(): DroneStatusResponse[] {
    return this.dronesService.findAll().map(DroneStatusResponse.fromDomain);
  }
}
