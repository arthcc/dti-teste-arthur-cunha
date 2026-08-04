import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { GRID_SIZE } from '../../../../common/config/simulation.config';

export class LocationForm {
  @ApiProperty({
    example: 5,
    minimum: 0,
    maximum: GRID_SIZE,
    description: 'Coordenada X do cliente na malha.',
  })
  @IsInt({ message: 'location.x deve ser um número inteiro (quadras da malha)' })
  @Min(0, { message: `location.x deve estar entre 0 e ${GRID_SIZE}` })
  @Max(GRID_SIZE, { message: `location.x deve estar entre 0 e ${GRID_SIZE}` })
  x: number;

  @ApiProperty({
    example: 8,
    minimum: 0,
    maximum: GRID_SIZE,
    description: 'Coordenada Y do cliente na malha.',
  })
  @IsInt({ message: 'location.y deve ser um número inteiro (quadras da malha)' })
  @Min(0, { message: `location.y deve estar entre 0 e ${GRID_SIZE}` })
  @Max(GRID_SIZE, { message: `location.y deve estar entre 0 e ${GRID_SIZE}` })
  y: number;
}
