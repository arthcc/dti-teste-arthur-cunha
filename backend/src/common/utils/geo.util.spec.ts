import { GRID_SIZE } from '../config/simulation.config';
import { Rect } from '../interfaces/rect.interface';
import {
  BASE,
  buildLeg,
  buildRoute,
  distance,
  findPath,
  isBlocked,
  isInside,
  pathDistance,
  pointAlongPath,
  routeDistance,
  simplifyPath,
  sortByNearestNeighbor,
  travelDistance,
} from './geo.util';

const WALL: Rect = { minX: 1, minY: 0, maxX: 3, maxY: 3 };

describe('geo.util', () => {
  describe('distance', () => {
    it('mede a linha reta entre dois pontos', () => {
      expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });

    it('é zero para o mesmo ponto', () => {
      expect(distance({ x: 7, y: 2 }, { x: 7, y: 2 })).toBe(0);
    });
  });

  describe('isInside / isBlocked', () => {
    it('trata os limites do retângulo como inclusivos', () => {
      expect(isInside({ x: 1, y: 0 }, WALL)).toBe(true);
      expect(isInside({ x: 3, y: 3 }, WALL)).toBe(true);
    });

    it('deixa de fora os pontos além da borda', () => {
      expect(isInside({ x: 0, y: 0 }, WALL)).toBe(false);
      expect(isInside({ x: 4, y: 0 }, WALL)).toBe(false);
    });

    it('bloqueia um ponto coberto por qualquer zona', () => {
      const zones: Rect[] = [WALL, { minX: 10, minY: 10, maxX: 11, maxY: 11 }];
      expect(isBlocked({ x: 10, y: 11 }, zones)).toBe(true);
      expect(isBlocked({ x: 9, y: 9 }, zones)).toBe(false);
    });

    it('não bloqueia nada quando não há zonas', () => {
      expect(isBlocked({ x: 5, y: 5 }, [])).toBe(false);
    });
  });

  describe('findPath', () => {
    it('vai direto quando não há obstáculo', () => {
      const path = findPath({ x: 0, y: 0 }, { x: 3, y: 3 });
      expect(path).not.toBeNull();
      expect(path).toHaveLength(4);
      expect(pathDistance(path!)).toBeCloseTo(3 * Math.SQRT2, 6);
    });

    it('devolve só a origem quando origem e destino coincidem', () => {
      expect(findPath({ x: 4, y: 4 }, { x: 4, y: 4 })).toEqual([
        { x: 4, y: 4 },
      ]);
    });

    it('recusa coordenadas negativas', () => {
      expect(findPath({ x: -1, y: 0 }, { x: 2, y: 2 })).toBeNull();
      expect(findPath({ x: 0, y: 0 }, { x: 2, y: -3 })).toBeNull();
    });

    it('recusa coordenadas acima do tamanho da malha', () => {
      expect(findPath({ x: 0, y: 0 }, { x: GRID_SIZE + 1, y: 0 })).toBeNull();
      expect(findPath({ x: 0, y: GRID_SIZE + 5 }, { x: 0, y: 0 })).toBeNull();
    });

    it('aceita exatamente a borda da malha', () => {
      const path = findPath({ x: 0, y: 0 }, { x: GRID_SIZE, y: GRID_SIZE });
      expect(path).not.toBeNull();
      expect(path![path!.length - 1]).toEqual({
        x: GRID_SIZE,
        y: GRID_SIZE,
      });
    });

    it('recusa origem ou destino dentro de uma zona', () => {
      expect(findPath({ x: 2, y: 2 }, { x: 8, y: 8 }, [WALL])).toBeNull();
      expect(findPath({ x: 8, y: 8 }, { x: 2, y: 2 }, [WALL])).toBeNull();
    });

    it('contorna a zona em vez de atravessá-la', () => {
      const path = findPath({ x: 0, y: 0 }, { x: 4, y: 0 }, [WALL]);

      expect(path).not.toBeNull();
      expect(path!.every((p) => !isBlocked(p, [WALL]))).toBe(true);
      expect(pathDistance(path!)).toBeGreaterThan(
        distance({ x: 0, y: 0 }, { x: 4, y: 0 }),
      );
    });

    it('não corta a quina entre duas zonas na diagonal', () => {
      const corner: Rect[] = [
        { minX: 1, minY: 0, maxX: 1, maxY: 0 },
        { minX: 0, minY: 1, maxX: 0, maxY: 1 },
      ];
      expect(findPath({ x: 0, y: 0 }, { x: 1, y: 1 }, corner)).toBeNull();
    });

    it('devolve null quando o destino está cercado', () => {
      const ring: Rect[] = [
        { minX: 9, maxX: 11, minY: 9, maxY: 9 },
        { minX: 9, maxX: 11, minY: 11, maxY: 11 },
        { minX: 9, maxX: 9, minY: 10, maxY: 10 },
        { minX: 11, maxX: 11, minY: 10, maxY: 10 },
      ];
      expect(findPath(BASE, { x: 10, y: 10 }, ring)).toBeNull();
    });
  });

  describe('simplifyPath', () => {
    it('preserva caminhos de até dois pontos', () => {
      expect(simplifyPath([])).toEqual([]);
      expect(simplifyPath([{ x: 1, y: 1 }])).toEqual([{ x: 1, y: 1 }]);
    });

    it('remove os pontos colineares intermediários', () => {
      const straight = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ];
      expect(simplifyPath(straight)).toEqual([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ]);
    });

    it('mantém os vértices onde a direção muda', () => {
      const bent = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
      ];
      expect(simplifyPath(bent)).toEqual([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
      ]);
    });

    it('não altera o comprimento total do trajeto', () => {
      const path = findPath({ x: 0, y: 0 }, { x: 4, y: 0 }, [WALL])!;
      expect(pathDistance(simplifyPath(path))).toBeCloseTo(
        pathDistance(path),
        6,
      );
    });
  });

  describe('travelDistance', () => {
    it('usa a linha reta quando não há zonas', () => {
      expect(travelDistance({ x: 0, y: 0 }, { x: 6, y: 8 })).toBe(10);
    });

    it('cobra o desvio quando há zona no caminho', () => {
      const direct = distance({ x: 0, y: 0 }, { x: 4, y: 0 });
      expect(
        travelDistance({ x: 0, y: 0 }, { x: 4, y: 0 }, [WALL]),
      ).toBeGreaterThan(direct);
    });

    it('é infinita quando não há rota', () => {
      expect(travelDistance(BASE, { x: 2, y: 2 }, [WALL])).toBe(Infinity);
    });
  });

  describe('routeDistance', () => {
    it('é zero sem paradas', () => {
      expect(routeDistance([])).toBe(0);
    });

    it('fecha o circuito voltando para a base', () => {
      expect(routeDistance([{ x: 3, y: 0 }])).toBeCloseTo(6, 6);
      expect(
        routeDistance([
          { x: 3, y: 0 },
          { x: 3, y: 4 },
        ]),
      ).toBeCloseTo(3 + 4 + 5, 6);
    });

    it('é infinita quando alguma parada é inalcançável', () => {
      expect(routeDistance([{ x: 2, y: 2 }], [WALL])).toBe(Infinity);
    });
  });

  describe('buildLeg', () => {
    it('entrega o trecho simplificado com a distância real', () => {
      const leg = buildLeg({ x: 0, y: 0 }, { x: 4, y: 0 }, [WALL]);

      expect(leg).not.toBeNull();
      expect(leg!.from).toEqual({ x: 0, y: 0 });
      expect(leg!.to).toEqual({ x: 4, y: 0 });
      expect(leg!.distanceKm).toBeGreaterThan(4);
      expect(leg!.path.length).toBeLessThan(
        findPath({ x: 0, y: 0 }, { x: 4, y: 0 }, [WALL])!.length,
      );
    });

    it('devolve null para um trecho intransponível', () => {
      expect(buildLeg(BASE, { x: 2, y: 2 }, [WALL])).toBeNull();
    });
  });

  describe('buildRoute', () => {
    it('monta base → paradas → base', () => {
      const shape = buildRoute([
        { x: 3, y: 0 },
        { x: 3, y: 4 },
      ]);

      expect(shape).not.toBeNull();
      expect(shape!.legs).toHaveLength(3);
      expect(shape!.path[0]).toEqual(BASE);
      expect(shape!.path[shape!.path.length - 1]).toEqual(BASE);
      expect(shape!.distanceKm).toBeCloseTo(3 + 4 + (3 * Math.SQRT2 + 1), 6);
    });

    it('mede a volta pela malha, em 8 direções, e não pela reta', () => {
      const shape = buildRoute([{ x: 3, y: 4 }]);

      expect(shape!.distanceKm).toBeGreaterThan(
        2 * distance(BASE, { x: 3, y: 4 }),
      );
      expect(shape!.distanceKm).toBeCloseTo(2 * (3 * Math.SQRT2 + 1), 6);
    });

    it('devolve null quando alguma parada é inalcançável', () => {
      expect(buildRoute([{ x: 2, y: 2 }], [WALL])).toBeNull();
    });

    it('mantém a polilinha fora das zonas', () => {
      const shape = buildRoute([{ x: 4, y: 0 }], [WALL]);

      expect(shape).not.toBeNull();
      expect(shape!.path.every((p) => !isBlocked(p, [WALL]))).toBe(true);
    });
  });

  describe('sortByNearestNeighbor', () => {
    it('visita primeiro o ponto mais próximo da origem', () => {
      const sorted = sortByNearestNeighbor([
        { x: 10, y: 0 },
        { x: 1, y: 0 },
        { x: 5, y: 0 },
      ]);

      expect(sorted).toEqual([
        { x: 1, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ]);
    });

    it('devolve lista vazia para entrada vazia', () => {
      expect(sortByNearestNeighbor([])).toEqual([]);
    });
  });

  describe('pointAlongPath', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
    ];

    it('devolve a base para um caminho vazio', () => {
      expect(pointAlongPath([], 5)).toEqual(BASE);
    });

    it('devolve o primeiro ponto quando nada foi percorrido', () => {
      expect(pointAlongPath(path, 0)).toEqual({ x: 0, y: 0 });
      expect(pointAlongPath(path, -3)).toEqual({ x: 0, y: 0 });
    });

    it('interpola dentro do segmento atual', () => {
      expect(pointAlongPath(path, 2.5)).toEqual({ x: 0, y: 2.5 });
      expect(pointAlongPath(path, 14)).toEqual({ x: 4, y: 10 });
    });

    it('para no último ponto quando passa do fim', () => {
      expect(pointAlongPath(path, 999)).toEqual({ x: 10, y: 10 });
    });
  });
});
