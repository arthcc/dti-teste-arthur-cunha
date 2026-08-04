import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Coordinate } from '../../common/interfaces/coordinate.interface';
import { Rect } from '../../common/interfaces/rect.interface';
import { BASE, isBlocked, isInside } from '../../common/utils/geo.util';
import { CreateZoneForm } from './dto/forms/create-zone.form';
import { NoFlyZone } from './interfaces/zone.interface';

@Injectable()
export class ZonesService {
  private readonly logger = new Logger(ZonesService.name);
  private readonly zones = new Map<string, NoFlyZone>();
  private counter = 0;

  create(form: CreateZoneForm): NoFlyZone {
    if (form.minX > form.maxX) {
      throw new BadRequestException('minX não pode ser maior que maxX');
    }
    if (form.minY > form.maxY) {
      throw new BadRequestException('minY não pode ser maior que maxY');
    }

    const rect: Rect = {
      minX: form.minX,
      minY: form.minY,
      maxX: form.maxX,
      maxY: form.maxY,
    };

    if (isInside(BASE, rect)) {
      throw new UnprocessableEntityException(
        'A zona não pode cobrir a base em (0,0) — nenhum drone conseguiria decolar.',
      );
    }

    this.counter += 1;
    const zone: NoFlyZone = {
      id: randomUUID(),
      name: form.name?.trim() || `Zona ${this.counter}`,
      ...rect,
      createdAt: new Date(),
    };
    this.zones.set(zone.id, zone);
    this.logger.log(
      `Zona de exclusão criada: ${zone.name} (${zone.id}) ` +
        `[${zone.minX},${zone.minY}] → [${zone.maxX},${zone.maxY}]`,
    );
    return zone;
  }

  findAll(): NoFlyZone[] {
    return [...this.zones.values()];
  }

  rects(): Rect[] {
    return this.findAll().map(({ minX, minY, maxX, maxY }) => ({
      minX,
      minY,
      maxX,
      maxY,
    }));
  }

  findById(id: string): NoFlyZone {
    const zone = this.zones.get(id);
    if (!zone) {
      this.logger.warn(`Zona não encontrada: ${id}`);
      throw new NotFoundException(`Zona ${id} não encontrada`);
    }
    return zone;
  }

  remove(id: string): void {
    const zone = this.findById(id);
    this.zones.delete(id);
    this.logger.log(`Zona removida: ${zone.name} (${id})`);
  }

  zoneAt(point: Coordinate): NoFlyZone | null {
    return this.findAll().find((z) => isInside(point, z)) ?? null;
  }

  blocks(point: Coordinate): boolean {
    return isBlocked(point, this.rects());
  }
}
