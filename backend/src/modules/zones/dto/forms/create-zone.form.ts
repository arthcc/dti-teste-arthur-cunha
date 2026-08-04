import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { GRID_SIZE } from '../../../../common/config/simulation.config';

export class CreateZoneForm {
  @ApiProperty({
    example: 'Heliponto central',
    description: 'Nome da zona de exclusão.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(40, { message: 'name deve ter no máximo 40 caracteres' })
  name?: string;

  @ApiProperty({ example: 4, description: 'Menor X da zona (inclusivo).' })
  @IsInt({ message: 'minX deve ser um número inteiro' })
  @Min(0, { message: 'minX deve estar entre 0 e ' + GRID_SIZE })
  @Max(GRID_SIZE, { message: 'minX deve estar entre 0 e ' + GRID_SIZE })
  minX: number;

  @ApiProperty({ example: 4, description: 'Menor Y da zona (inclusivo).' })
  @IsInt({ message: 'minY deve ser um número inteiro' })
  @Min(0, { message: 'minY deve estar entre 0 e ' + GRID_SIZE })
  @Max(GRID_SIZE, { message: 'minY deve estar entre 0 e ' + GRID_SIZE })
  minY: number;

  @ApiProperty({ example: 8, description: 'Maior X da zona (inclusivo).' })
  @IsInt({ message: 'maxX deve ser um número inteiro' })
  @Min(0, { message: 'maxX deve estar entre 0 e ' + GRID_SIZE })
  @Max(GRID_SIZE, { message: 'maxX deve estar entre 0 e ' + GRID_SIZE })
  maxX: number;

  @ApiProperty({ example: 9, description: 'Maior Y da zona (inclusivo).' })
  @IsInt({ message: 'maxY deve ser um número inteiro' })
  @Min(0, { message: 'maxY deve estar entre 0 e ' + GRID_SIZE })
  @Max(GRID_SIZE, { message: 'maxY deve estar entre 0 e ' + GRID_SIZE })
  maxY: number;
}
