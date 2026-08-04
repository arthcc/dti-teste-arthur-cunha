import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateZoneForm } from './dto/forms/create-zone.form';
import { ZoneResponse } from './dto/responses/zone.response';
import { ZonesService } from './zones.service';

@ApiTags('zonas')
@Controller('zonas')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Cria uma zona de exclusão aérea. As rotas passam a desviar do retângulo.',
  })
  @ApiCreatedResponse({ type: ZoneResponse })
  create(@Body() form: CreateZoneForm): ZoneResponse {
    return ZoneResponse.fromDomain(this.zonesService.create(form));
  }

  @Get()
  @ApiOperation({ summary: 'Lista as zonas de exclusão aérea ativas.' })
  @ApiOkResponse({ type: ZoneResponse, isArray: true })
  findAll(): ZoneResponse[] {
    return this.zonesService.findAll().map(ZoneResponse.fromDomain);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma zona de exclusão aérea.' })
  @ApiNoContentResponse()
  remove(@Param('id') id: string): void {
    this.zonesService.remove(id);
  }
}
