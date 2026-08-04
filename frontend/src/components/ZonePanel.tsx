import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import { GRID_SIZE } from '../api/config';
import type { NoFlyZone, OrderLimits } from '../api/types';
import { useToast } from './Toast';

interface Props {
  zones: NoFlyZone[];
  limits: OrderLimits | null;
  onChanged: () => void;
}

interface Errors {
  minX?: string;
  minY?: string;
  maxX?: string;
  maxY?: string;
  form?: string;
}

type Field = 'minX' | 'minY' | 'maxX' | 'maxY';

const FIELDS: Array<{ key: Field; label: string }> = [
  { key: 'minX', label: 'X inicial' },
  { key: 'minY', label: 'Y inicial' },
  { key: 'maxX', label: 'X final' },
  { key: 'maxY', label: 'Y final' },
];

export function ZonePanel({ zones, limits, onChanged }: Props) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [values, setValues] = useState<Record<Field, string>>({
    minX: '',
    minY: '',
    maxX: '',
    maxY: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const grid = limits?.gridSize ?? GRID_SIZE;

  const setField = (key: Field, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  const validate = (): Errors => {
    const next: Errors = {};
    const parsed = {} as Record<Field, number>;

    for (const { key } of FIELDS) {
      const raw = values[key].trim();
      const n = Number(raw);
      parsed[key] = n;
      if (raw === '' || Number.isNaN(n)) next[key] = 'Obrigatório';
      else if (!Number.isInteger(n)) next[key] = 'Inteiro';
      else if (n < 0 || n > grid) next[key] = `0 a ${grid}`;
    }

    if (Object.keys(next).length > 0) return next;

    if (parsed.minX > parsed.maxX) next.form = 'O X inicial não pode ser maior que o final.';
    else if (parsed.minY > parsed.maxY) {
      next.form = 'O Y inicial não pode ser maior que o final.';
    } else if (
      parsed.minX <= 0 &&
      parsed.maxX >= 0 &&
      parsed.minY <= 0 &&
      parsed.maxY >= 0
    ) {
      next.form = 'A zona não pode cobrir a base em (0,0) — a frota ficaria sem rota.';
    }

    return next;
  };

  const addZone = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await api.createZone({
        name: name.trim() || undefined,
        minX: Number(values.minX),
        minY: Number(values.minY),
        maxX: Number(values.maxX),
        maxY: Number(values.maxY),
      });
      toast.push('Zona de exclusão criada', {
        detail: 'As rotas passam a contornar a área.',
      });
      setName('');
      setValues({ minX: '', minY: '', maxX: '', maxY: '' });
      setErrors({});
      setAdding(false);
      onChanged();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Tente novamente.';
      setErrors({ form: message });
      toast.push('Não foi possível criar a zona', { detail: message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const removeZone = async (zone: NoFlyZone) => {
    setRemoving(zone.id);
    try {
      await api.deleteZone(zone.id);
      toast.push('Zona removida', { detail: zone.name });
      onChanged();
    } catch (err) {
      toast.push('Não foi possível remover a zona', {
        detail: err instanceof ApiError ? err.message : 'Tente novamente.',
        tone: 'error',
      });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className="sheet">
      <header className="sheet__head sheet__head--row">
        <div>
          <span className="label">restrições · {zones.length}</span>
          <h2>Zonas de exclusão</h2>
        </div>
        <button className="btn btn--quiet" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancelar' : 'Adicionar'}
        </button>
      </header>

      {adding && (
        <form className="subform" onSubmit={addZone} noValidate>
          <input
            className="input"
            placeholder="Nome (opcional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="quad">
            {FIELDS.map(({ key, label }) => (
              <label className="field" key={key}>
                <span className="field__label">{label}</span>
                <input
                  className={`input data ${errors[key] ? 'input--error' : ''}`}
                  inputMode="numeric"
                  placeholder="0"
                  value={values[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  aria-invalid={Boolean(errors[key])}
                />
                {errors[key] && <span className="field__error">{errors[key]}</span>}
              </label>
            ))}
          </div>

          {errors.form && (
            <p className="form-error" role="alert">
              {errors.form}
            </p>
          )}

          <button className="btn btn--solid" type="submit" disabled={busy}>
            {busy ? 'Criando…' : 'Criar zona'}
          </button>
        </form>
      )}

      {zones.length === 0 && !adding && (
        <p className="empty">
          Nenhuma zona ativa. As rotas seguem em linha reta entre a base e os clientes.
        </p>
      )}

      {zones.length > 0 && (
        <ul className="zones">
          {zones.map((z) => (
            <li key={z.id} className="zone">
              <span className="zone__body">
                <span className="zone__name">{z.name}</span>
                <span className="zone__span data">
                  ({z.minX}, {z.minY}) → ({z.maxX}, {z.maxY}) · {z.blockedPoints} pontos
                </span>
              </span>
              <button
                type="button"
                className="btn btn--quiet"
                disabled={removing === z.id}
                onClick={() => removeZone(z)}
              >
                {removing === z.id ? '…' : 'Remover'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
