import {
  MAX_SPEED_KMH,
  MIN_SPEED_KMH,
} from '../../../../common/config/simulation.config';
import { validateForm } from '../../../../testing/validation';
import { CreateDroneForm } from './create-drone.form';

const VALID = { name: 'Drone Alpha', capacityKg: 10, rangeKm: 20 };

const validate = (payload: Record<string, unknown>): string[] =>
  validateForm(CreateDroneForm, payload);

describe('CreateDroneForm', () => {
  it('aceita um cadastro válido', () => {
    expect(validate(VALID)).toEqual([]);
  });

  it('aceita cadastro sem nome e sem velocidade', () => {
    expect(validate({ capacityKg: 10, rangeKm: 20 })).toEqual([]);
  });

  it('recusa capacidade zero ou negativa', () => {
    expect(validate({ ...VALID, capacityKg: 0 })).toContain(
      'capacityKg deve ser maior que zero',
    );
    expect(validate({ ...VALID, capacityKg: -5 })).toContain(
      'capacityKg deve ser maior que zero',
    );
  });

  it('recusa autonomia zero ou negativa', () => {
    expect(validate({ ...VALID, rangeKm: 0 })).toContain(
      'rangeKm deve ser maior que zero',
    );
  });

  it('recusa capacidade e autonomia acima do teto', () => {
    expect(validate({ ...VALID, capacityKg: 501 })).toContain(
      'capacityKg deve ser no máximo 500',
    );
    expect(validate({ ...VALID, rangeKm: 501 })).toContain(
      'rangeKm deve ser no máximo 500',
    );
  });

  it('recusa velocidade fora da faixa aceita', () => {
    const esperado = `speedKmh deve estar entre ${MIN_SPEED_KMH} e ${MAX_SPEED_KMH}`;

    expect(validate({ ...VALID, speedKmh: MIN_SPEED_KMH - 1 })).toContain(
      esperado,
    );
    expect(validate({ ...VALID, speedKmh: MAX_SPEED_KMH + 1 })).toContain(
      esperado,
    );
  });

  it('aceita as pontas da faixa de velocidade', () => {
    expect(validate({ ...VALID, speedKmh: MIN_SPEED_KMH })).toEqual([]);
    expect(validate({ ...VALID, speedKmh: MAX_SPEED_KMH })).toEqual([]);
  });

  it('recusa nome longo demais', () => {
    expect(validate({ ...VALID, name: 'x'.repeat(41) })).toContain(
      'name deve ter no máximo 40 caracteres',
    );
  });
});
