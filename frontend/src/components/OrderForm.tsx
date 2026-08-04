import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import { GRID_SIZE, PRIORITY_LABEL } from '../api/config';
import { straightRoundTripKm, zoneAt } from '../api/geo';
import type { NoFlyZone, OrderLimits, Priority } from '../api/types';
import { useToast } from './Toast';

interface Props {
  limits: OrderLimits | null;
  zones: NoFlyZone[];
  onCreated: () => void;
}

interface Errors {
  x?: string;
  y?: string;
  weight?: string;
  form?: string;
}

const PRIORITIES: Priority[] = ['high', 'medium', 'low'];

export function OrderForm({ limits, zones, onCreated }: Props) {
  const toast = useToast();
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [weight, setWeight] = useState('');
  const [priority, setPriority] = useState<Priority>('high');
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const grid = limits?.gridSize ?? GRID_SIZE;
  const maxCapacity = limits?.maxCapacityKg ?? 0;
  const hasFleet = (limits?.fleetSize ?? 0) > 0;
  const usableRange = limits
    ? limits.maxRangeKm * (1 - limits.batteryReservePercent / 100)
    : 0;

  const validate = (): Errors => {
    const next: Errors = {};
    const nx = Number(x.trim());
    const ny = Number(y.trim());
    const nw = Number(weight.trim().replace(',', '.'));

    if (x.trim() === '' || Number.isNaN(nx)) next.x = 'Informe X';
    else if (!Number.isInteger(nx)) next.x = 'Use um número inteiro';
    else if (nx < 0 || nx > grid) next.x = `Use 0 a ${grid}`;

    if (y.trim() === '' || Number.isNaN(ny)) next.y = 'Informe Y';
    else if (!Number.isInteger(ny)) next.y = 'Use um número inteiro';
    else if (ny < 0 || ny > grid) next.y = `Use 0 a ${grid}`;

    if (weight.trim() === '' || Number.isNaN(nw)) next.weight = 'Informe o peso';
    else if (nw <= 0) next.weight = 'O peso precisa ser maior que zero';
    else if (hasFleet && nw > maxCapacity) {
      next.weight = `Acima da capacidade do maior drone (${maxCapacity} kg)`;
    }

    if (!next.x && !next.y) {
      const point = { x: nx, y: ny };

      const zone = zoneAt(point, zones);
      if (zone) {
        next.form = `O destino (${nx}, ${ny}) está dentro da zona de exclusão "${zone.name}".`;
      } else if (hasFleet) {
        const roundTrip = straightRoundTripKm(point);
        if (roundTrip > usableRange) {
          next.form =
            `A ida e volta até (${nx}, ${ny}) dá no mínimo ${roundTrip.toFixed(1)} km, ` +
            `acima do alcance útil da frota (${usableRange.toFixed(1)} km, já descontada ` +
            `a reserva de ${limits?.batteryReservePercent}% de bateria).`;
        }
      }
    }

    return next;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await api.createOrder({
        location: { x: Number(x.trim()), y: Number(y.trim()) },
        weightKg: Number(weight.trim().replace(',', '.')),
        priority,
      });
      toast.push('Pedido registrado', {
        detail: `(${x}, ${y}) · ${weight} kg · ${PRIORITY_LABEL[priority].toLowerCase()}`,
      });
      setX('');
      setY('');
      setWeight('');
      setPriority('high');
      setErrors({});
      onCreated();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Tente novamente.';
      setErrors({ form: message });
      toast.push('Não foi possível registrar o pedido', {
        detail: message,
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="sheet" onSubmit={submit} noValidate>
      <header className="sheet__head">
        <span className="label">despacho</span>
        <h2>Novo pedido</h2>
      </header>

      <div className="pair">
        <label className="field">
          <span className="field__label">Coordenada X</span>
          <input
            className={`input data ${errors.x ? 'input--error' : ''}`}
            inputMode="numeric"
            value={x}
            onChange={(e) => setX(e.target.value)}
            placeholder="0"
            aria-invalid={Boolean(errors.x)}
          />
          {errors.x && <span className="field__error">{errors.x}</span>}
        </label>
        <label className="field">
          <span className="field__label">Coordenada Y</span>
          <input
            className={`input data ${errors.y ? 'input--error' : ''}`}
            inputMode="numeric"
            value={y}
            onChange={(e) => setY(e.target.value)}
            placeholder="0"
            aria-invalid={Boolean(errors.y)}
          />
          {errors.y && <span className="field__error">{errors.y}</span>}
        </label>
      </div>

      <label className="field">
        <span className="field__label">
          Peso do pacote
          {hasFleet && <em className="field__hint data">máx {maxCapacity} kg</em>}
        </span>
        <span className="input-wrap">
          <input
            className={`input data ${errors.weight ? 'input--error' : ''}`}
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="0,0"
            aria-invalid={Boolean(errors.weight)}
          />
          <em className="input-unit data">kg</em>
        </span>
        {errors.weight && <span className="field__error">{errors.weight}</span>}
      </label>

      <div className="field" role="group" aria-labelledby="prio-label">
        <span className="field__label" id="prio-label">
          Prioridade
        </span>
        <div className="choice__row">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              className={`choice__item ${priority === p ? 'is-on' : ''}`}
              aria-pressed={priority === p}
              onClick={() => setPriority(p)}
            >
              <i className={`swatch swatch--${p}`} aria-hidden="true" />
              {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {errors.form && (
        <p className="form-error" role="alert">
          {errors.form}
        </p>
      )}

      <button className="btn btn--solid" type="submit" disabled={submitting}>
        {submitting ? 'Registrando…' : 'Registrar pedido'}
      </button>

      <p className="hint data">
        malha 0–{grid} (inteiros) · base em (0,0)
        {hasFleet
          ? ` · alcance útil ${usableRange.toFixed(0)} km`
          : ' · cadastre um drone para validar peso e alcance'}
        {zones.length > 0 && ` · ${zones.length} zona(s) de exclusão`}
      </p>
    </form>
  );
}
