import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZonesService } from './zones.service';

describe('ZonesService', () => {
  let service: ZonesService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ZonesService],
    }).compile();

    service = moduleRef.get(ZonesService);
  });

  describe('create', () => {
    it('registra a zona com os limites informados', () => {
      const zone = service.create({
        name: 'Heliponto',
        minX: 4,
        minY: 4,
        maxX: 8,
        maxY: 9,
      });

      expect(zone.id).toEqual(expect.any(String));
      expect(zone.name).toBe('Heliponto');
      expect(zone).toMatchObject({ minX: 4, minY: 4, maxX: 8, maxY: 9 });
      expect(service.findAll()).toHaveLength(1);
    });

    it('gera um nome sequencial quando nenhum é informado', () => {
      const primeira = service.create({ minX: 3, minY: 3, maxX: 4, maxY: 4 });
      const segunda = service.create({
        name: '   ',
        minX: 6,
        minY: 6,
        maxX: 7,
        maxY: 7,
      });

      expect(primeira.name).toBe('Zona 1');
      expect(segunda.name).toBe('Zona 2');
    });

    it('recusa retângulo com minX maior que maxX', () => {
      expect(() =>
        service.create({ minX: 8, minY: 1, maxX: 4, maxY: 4 }),
      ).toThrow(BadRequestException);
    });

    it('recusa retângulo com minY maior que maxY', () => {
      expect(() =>
        service.create({ minX: 1, minY: 9, maxX: 4, maxY: 4 }),
      ).toThrow(BadRequestException);
    });

    it('recusa zona que cobre a base, que deixaria a frota presa', () => {
      expect(() =>
        service.create({ minX: 0, minY: 0, maxX: 2, maxY: 2 }),
      ).toThrow(UnprocessableEntityException);
      expect(service.findAll()).toHaveLength(0);
    });

    it('aceita zona encostada na base sem cobri-la', () => {
      expect(() =>
        service.create({ minX: 1, minY: 0, maxX: 2, maxY: 2 }),
      ).not.toThrow();
    });
  });

  describe('consultas', () => {
    beforeEach(() => {
      service.create({ name: 'Centro', minX: 4, minY: 4, maxX: 8, maxY: 9 });
    });

    it('encontra a zona que cobre um ponto', () => {
      expect(service.zoneAt({ x: 5, y: 5 })?.name).toBe('Centro');
      expect(service.zoneAt({ x: 4, y: 9 })?.name).toBe('Centro');
    });

    it('devolve null para um ponto livre', () => {
      expect(service.zoneAt({ x: 3, y: 5 })).toBeNull();
    });

    it('expõe blocks como atalho booleano', () => {
      expect(service.blocks({ x: 6, y: 6 })).toBe(true);
      expect(service.blocks({ x: 0, y: 0 })).toBe(false);
    });

    it('expõe os retângulos sem os metadados', () => {
      expect(service.rects()).toEqual([
        { minX: 4, minY: 4, maxX: 8, maxY: 9 },
      ]);
    });
  });

  describe('remove', () => {
    it('apaga a zona e libera o espaço aéreo', () => {
      const zone = service.create({ minX: 4, minY: 4, maxX: 8, maxY: 9 });

      service.remove(zone.id);

      expect(service.findAll()).toHaveLength(0);
      expect(service.blocks({ x: 6, y: 6 })).toBe(false);
    });

    it('falha para um id inexistente', () => {
      expect(() => service.remove('nao-existe')).toThrow(NotFoundException);
    });
  });
});
