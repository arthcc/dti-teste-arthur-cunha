import { ApiProperty } from '@nestjs/swagger';

export class CoordinateResponse {
  @ApiProperty({ example: 5, description: 'Coordenada X na malha.' })
  x: number;

  @ApiProperty({ example: 8, description: 'Coordenada Y na malha.' })
  y: number;
}
