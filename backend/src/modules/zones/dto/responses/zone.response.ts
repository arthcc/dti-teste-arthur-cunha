import { ApiProperty } from '@nestjs/swagger';
import { NoFlyZone } from '../../interfaces/zone.interface';

export class ZoneResponse {
  @ApiProperty({ example: 'a1b2c3' })
  id: string;

  @ApiProperty({ example: 'Zona 1' })
  name: string;

  @ApiProperty({ example: 4 })
  minX: number;

  @ApiProperty({ example: 4 })
  minY: number;

  @ApiProperty({ example: 8 })
  maxX: number;

  @ApiProperty({ example: 9 })
  maxY: number;

  @ApiProperty({
    example: 30,
    description: 'Quantidade de pontos da malha bloqueados pela zona.',
  })
  blockedPoints: number;

  @ApiProperty({ example: '2026-08-03T14:30:00.000Z' })
  createdAt: string;

  static fromDomain(zone: NoFlyZone): ZoneResponse {
    const dto = new ZoneResponse();
    dto.id = zone.id;
    dto.name = zone.name;
    dto.minX = zone.minX;
    dto.minY = zone.minY;
    dto.maxX = zone.maxX;
    dto.maxY = zone.maxY;
    dto.blockedPoints =
      (zone.maxX - zone.minX + 1) * (zone.maxY - zone.minY + 1);
    dto.createdAt = zone.createdAt.toISOString();
    return dto;
  }
}
