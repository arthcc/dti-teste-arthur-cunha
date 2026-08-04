import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DEFAULT_SPEED_KMH,
  MAX_SPEED_KMH,
  MIN_SPEED_KMH,
} from '../../../../common/config/simulation.config';

const MAX_CAPACITY_KG = 500;
const MAX_RANGE_KM = 500;

export class CreateDroneForm {
  @ApiProperty({
    example: 'Drone Alpha',
    description: 'Nome/identificação amigável do drone.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(40, { message: 'name deve ter no máximo 40 caracteres' })
  name?: string;

  @ApiProperty({
    example: 10,
    description: 'Capacidade máxima de carga em quilogramas (X kg).',
  })
  @IsNumber({}, { message: 'capacityKg deve ser um número' })
  @IsPositive({ message: 'capacityKg deve ser maior que zero' })
  @Max(MAX_CAPACITY_KG, {
    message: `capacityKg deve ser no máximo ${MAX_CAPACITY_KG}`,
  })
  capacityKg: number;

  @ApiProperty({
    example: 20,
    description:
      'Autonomia por carga completa de bateria, em quilômetros (Y km).',
  })
  @IsNumber({}, { message: 'rangeKm deve ser um número' })
  @IsPositive({ message: 'rangeKm deve ser maior que zero' })
  @Max(MAX_RANGE_KM, { message: `rangeKm deve ser no máximo ${MAX_RANGE_KM}` })
  rangeKm: number;

  @ApiProperty({
    example: DEFAULT_SPEED_KMH,
    description: `Velocidade de cruzeiro em km/h (${MIN_SPEED_KMH} a ${MAX_SPEED_KMH}). Padrão: ${DEFAULT_SPEED_KMH}.`,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'speedKmh deve ser um número' })
  @Min(MIN_SPEED_KMH, {
    message: `speedKmh deve estar entre ${MIN_SPEED_KMH} e ${MAX_SPEED_KMH}`,
  })
  @Max(MAX_SPEED_KMH, {
    message: `speedKmh deve estar entre ${MIN_SPEED_KMH} e ${MAX_SPEED_KMH}`,
  })
  speedKmh?: number;
}
