import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import { DRONE_STATE_LABEL, formatMinutes } from '../api/config';
import type { DroneStatus, RoutePlan } from '../api/types';
import { useToast } from './Toast';

interface Props {
  drones: DroneStatus[];
  plan: RoutePlan | null;
  selectedDroneId: string | null;
  onSelectDrone: (id: string | null) => void;
  onChanged: () => void;
}

interface Errors {
  capacity?: string;
  range?: string;
  speed?: string;
  form?: string;
}

const MAX_CAPACITY_KG = 500;
const MAX_RANGE_KM = 500;
const MIN_SPEED_KMH = 5;
const MAX_SPEED_KMH = 150;

const LOW_BATTERY = 20;

export function FleetPanel({
  drones,
  plan,
  selectedDroneId,
  onSelectDrone,
  onChanged,
}: Props) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [range, setRange] = useState('');
  const [speed, setSpeed] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const tripByDrone = new Map(plan?.trips.map((t) => [t.droneId, t]) ?? []);

  const validate = (): Errors => {
    const next: Errors = {};
    const cap = Number(capacity.trim().replace(',', '.'));
    const rng = Number(range.trim().replace(',', '.'));
    const spd = speed.trim() === '' ? null : Number(speed.trim().replace(',', '.'));

    if (capacity.trim() === '' || Number.isNaN(cap)) next.capacity = 'Informe a capacidade';
    else if (cap <= 0) next.capacity = 'Precisa ser maior que zero';
    else if (cap > MAX_CAPACITY_KG) next.capacity = `Máximo ${MAX_CAPACITY_KG} kg`;

    if (range.trim() === '' || Number.isNaN(rng)) next.range = 'Informe o alcance';
    else if (rng <= 0) next.range = 'Precisa ser maior que zero';
    else if (rng > MAX_RANGE_KM) next.range = `Máximo ${MAX_RANGE_KM} km`;

    if (spd !== null) {
      if (Number.isNaN(spd)) next.speed = 'Velocidade inválida';
      else if (spd < MIN_SPEED_KMH || spd > MAX_SPEED_KMH) {
        next.speed = `Use ${MIN_SPEED_KMH} a ${MAX_SPEED_KMH} km/h`;
      }
    }

    return next;
  };

  const addDrone = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const cap = Number(capacity.trim().replace(',', '.'));
    const rng = Number(range.trim().replace(',', '.'));
    const spd = speed.trim() === '' ? undefined : Number(speed.trim().replace(',', '.'));

    setBusy(true);
    try {
      await api.createDrone({
        name: name.trim() || undefined,
        capacityKg: cap,
        rangeKm: rng,
        speedKmh: spd,
      });
      toast.push('Drone cadastrado', {
        detail: `${cap} kg · ${rng} km${spd ? ` · ${spd} km/h` : ''}`,
      });
      setName('');
      setCapacity('');
      setRange('');
      setSpeed('');
      setErrors({});
      setAdding(false);
      onChanged();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Tente novamente.';
      setErrors({ form: message });
      toast.push('Não foi possível cadastrar o drone', {
        detail: message,
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sheet">
      <header className="sheet__head sheet__head--row">
        <div>
          <span className="label">frota · {drones.length}</span>
          <h2>Drones</h2>
        </div>
        <button className="btn btn--quiet" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancelar' : 'Adicionar'}
        </button>
      </header>

      {adding && (
        <form className="subform" onSubmit={addDrone} noValidate>
          <input
            className="input"
            placeholder="Nome (opcional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="pair">
            <label className="field">
              <input
                className={`input data ${errors.capacity ? 'input--error' : ''}`}
                placeholder="Capacidade kg"
                inputMode="decimal"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                aria-invalid={Boolean(errors.capacity)}
                aria-label="Capacidade em kg"
              />
              {errors.capacity && <span className="field__error">{errors.capacity}</span>}
            </label>
            <label className="field">
              <input
                className={`input data ${errors.range ? 'input--error' : ''}`}
                placeholder="Alcance km"
                inputMode="decimal"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                aria-invalid={Boolean(errors.range)}
                aria-label="Alcance em km"
              />
              {errors.range && <span className="field__error">{errors.range}</span>}
            </label>
          </div>
          <label className="field">
            <input
              className={`input data ${errors.speed ? 'input--error' : ''}`}
              placeholder="Velocidade km/h (opcional, padrão 40)"
              inputMode="decimal"
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
              aria-invalid={Boolean(errors.speed)}
              aria-label="Velocidade em km/h"
            />
            {errors.speed && <span className="field__error">{errors.speed}</span>}
          </label>

          {errors.form && (
            <p className="form-error" role="alert">
              {errors.form}
            </p>
          )}

          <button className="btn btn--solid" type="submit" disabled={busy}>
            {busy ? 'Cadastrando…' : 'Cadastrar drone'}
          </button>
        </form>
      )}

      {drones.length === 0 && !adding && (
        <p className="empty">
          A frota está vazia. Cadastre um drone para o planejador começar a montar rotas.
        </p>
      )}

      <ul className="fleet">
        {drones.map((d) => {
          const trip = tripByDrone.get(d.id);
          const selected = d.id === selectedDroneId;
          const occupancy = trip ? Math.min(100, trip.occupancyPercent) : 0;
          const low = d.batteryPercent < LOW_BATTERY;
          return (
            <li key={d.id}>
              <button
                type="button"
                className={`drone ${selected ? 'is-selected' : ''}`}
                disabled={!trip}
                aria-pressed={selected}
                onClick={() => onSelectDrone(selected ? null : d.id)}
              >
                <span className="drone__top">
                  <span className="drone__name">{d.name}</span>
                  <span className={`state state--${d.state}`}>
                    {DRONE_STATE_LABEL[d.state]}
                  </span>
                </span>

                <span className="drone__specs data">
                  {d.capacityKg} kg · {d.rangeKm} km · {d.speedKmh} km/h · ({d.position.x},{' '}
                  {d.position.y})
                </span>

                <span className="battery" aria-hidden="true">
                  <i
                    className={low ? 'is-low' : ''}
                    style={{ width: `${Math.max(0, Math.min(100, d.batteryPercent))}%` }}
                  />
                </span>
                <span className={`drone__battery data ${low ? 'is-low' : ''}`}>
                  bateria {d.batteryPercent.toFixed(0)}% · restam{' '}
                  {d.remainingRangeKm.toFixed(1)} km
                  {!d.dispatchable && d.available && ' · recarregando'}
                </span>

                {trip ? (
                  <>
                    <span className="meter" aria-hidden="true">
                      <i style={{ width: `${occupancy}%` }} />
                    </span>
                    <span className="drone__trip data">
                      {trip.orders.length} entregas · {trip.totalWeightKg} kg ·{' '}
                      {trip.totalDistanceKm} km · {formatMinutes(trip.totalMinutes)} ·{' '}
                      {trip.occupancyPercent}%
                    </span>
                    {trip.detourKm > 0.05 && (
                      <span className="drone__trip drone__trip--note data">
                        +{trip.detourKm} km desviando de zonas
                      </span>
                    )}
                  </>
                ) : (
                  <span className="drone__trip drone__trip--idle data">
                    {d.deliveriesCompleted > 0
                      ? `${d.deliveriesCompleted} entrega(s) concluída(s)`
                      : 'Sem viagem atribuída'}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
