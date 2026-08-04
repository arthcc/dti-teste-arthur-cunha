import { GRID_SIZE } from '../../../../common/config/simulation.config';
import { Priority } from '../../../../common/enums/priority.enum';
import { validateForm } from '../../../../testing/validation';
import { CreateOrderForm } from './create-order.form';

const VALID = {
  location: { x: 5, y: 8 },
  weightKg: 3.5,
  priority: Priority.HIGH,
};

const validate = (payload: Record<string, unknown>): string[] =>
  validateForm(CreateOrderForm, payload);

describe('CreateOrderForm', () => {
  it('aceita um pedido válido', () => {
    expect(validate(VALID)).toEqual([]);
  });

  describe('coordenadas inválidas', () => {
    it('recusa coordenada negativa', () => {
      expect(validate({ ...VALID, location: { x: -1, y: 5 } })).toContain(
        `location.x deve estar entre 0 e ${GRID_SIZE}`,
      );
      expect(validate({ ...VALID, location: { x: 5, y: -3 } })).toContain(
        `location.y deve estar entre 0 e ${GRID_SIZE}`,
      );
    });

    it('recusa coordenada acima da malha', () => {
      expect(
        validate({ ...VALID, location: { x: GRID_SIZE + 1, y: 5 } }),
      ).toContain(`location.x deve estar entre 0 e ${GRID_SIZE}`);
      expect(
        validate({ ...VALID, location: { x: 5, y: GRID_SIZE + 100 } }),
      ).toContain(`location.y deve estar entre 0 e ${GRID_SIZE}`);
    });

    it('recusa coordenada fracionária', () => {
      expect(validate({ ...VALID, location: { x: 2.5, y: 5 } })).toContain(
        'location.x deve ser um número inteiro (quadras da malha)',
      );
    });

    it('recusa coordenada não numérica', () => {
      const messages = validate({ ...VALID, location: { x: 'oito', y: 5 } });
      expect(messages).toContain(
        'location.x deve ser um número inteiro (quadras da malha)',
      );
    });

    it('aceita exatamente as bordas da malha', () => {
      expect(validate({ ...VALID, location: { x: 0, y: 0 } })).toEqual([]);
      expect(
        validate({ ...VALID, location: { x: GRID_SIZE, y: GRID_SIZE } }),
      ).toEqual([]);
    });

    it('exige a localização', () => {
      const { location: _location, ...withoutLocation } = VALID;
      expect(validate(withoutLocation)).toContain('location é obrigatório');
    });
  });

  describe('peso', () => {
    it('recusa peso zero ou negativo', () => {
      expect(validate({ ...VALID, weightKg: 0 })).toContain(
        'weightKg deve ser maior que zero',
      );
      expect(validate({ ...VALID, weightKg: -2 })).toContain(
        'weightKg deve ser maior que zero',
      );
    });

    it('recusa peso acima do teto do formulário', () => {
      expect(validate({ ...VALID, weightKg: 501 })).toContain(
        'weightKg deve ser no máximo 500',
      );
    });

    it('recusa mais de três casas decimais', () => {
      expect(validate({ ...VALID, weightKg: 1.2345 })).toContain(
        'weightKg deve ser um número com até 3 casas decimais',
      );
    });
  });

  describe('prioridade', () => {
    it('aceita as três prioridades do domínio', () => {
      for (const priority of Object.values(Priority)) {
        expect(validate({ ...VALID, priority })).toEqual([]);
      }
    });

    it('recusa um valor fora do enum', () => {
      expect(validate({ ...VALID, priority: 'urgent' })).toContain(
        'priority deve ser low, medium ou high',
      );
    });
  });

  it('recusa propriedades não declaradas', () => {
    expect(validate({ ...VALID, express: true }).length).toBeGreaterThan(0);
  });
});
