import { GRID_SIZE } from '../../../../common/config/simulation.config';
import { validateForm } from '../../../../testing/validation';
import { CreateZoneForm } from './create-zone.form';

const VALID = { name: 'Centro', minX: 4, minY: 4, maxX: 8, maxY: 9 };

const validate = (payload: Record<string, unknown>): string[] =>
  validateForm(CreateZoneForm, payload);

describe('CreateZoneForm', () => {
  it('aceita uma zona válida', () => {
    expect(validate(VALID)).toEqual([]);
  });

  it('recusa limites negativos', () => {
    expect(validate({ ...VALID, minX: -1 })).toContain(
      `minX deve estar entre 0 e ${GRID_SIZE}`,
    );
    expect(validate({ ...VALID, minY: -4 })).toContain(
      `minY deve estar entre 0 e ${GRID_SIZE}`,
    );
  });

  it('recusa limites acima da malha', () => {
    expect(validate({ ...VALID, maxX: GRID_SIZE + 1 })).toContain(
      `maxX deve estar entre 0 e ${GRID_SIZE}`,
    );
    expect(validate({ ...VALID, maxY: GRID_SIZE + 1 })).toContain(
      `maxY deve estar entre 0 e ${GRID_SIZE}`,
    );
  });

  it('recusa limites fracionários', () => {
    expect(validate({ ...VALID, minX: 4.5 })).toContain(
      'minX deve ser um número inteiro',
    );
  });

  it('aceita uma zona de um único ponto', () => {
    expect(validate({ minX: 7, minY: 7, maxX: 7, maxY: 7 })).toEqual([]);
  });
});
