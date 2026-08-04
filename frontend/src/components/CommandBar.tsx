import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { formatMinutes } from '../api/config';
import type { SimulationState } from '../api/types';
import { useToast } from './Toast';

interface Props {
  online: boolean;
  lastSync: Date | null;
  simulation: SimulationState | null;
  onRefresh: () => void;
}

export function CommandBar({ online, lastSync, simulation, onRefresh }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, label: string) => {
    setBusy(true);
    try {
      await action();
      toast.push(label);
      onRefresh();
    } catch (err) {
      toast.push('Falha ao controlar a simulação', {
        detail: err instanceof ApiError ? err.message : 'Tente novamente.',
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const toggle = () =>
    simulation?.running
      ? run(api.pauseSimulation, 'Simulação pausada')
      : run(api.resumeSimulation, 'Simulação retomada');

  return (
    <header className="topbar">
      <div className="brand">
        <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
          <g stroke="var(--rule-2)" strokeWidth="1">
            <path d="M11.5 4.5v23M19.5 4.5v23M4.5 11.5h23M4.5 19.5h23" />
          </g>
          <rect x="4.5" y="4.5" width="23" height="23" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
          <path d="M6 26 L14 12 L23 9" fill="none" stroke="var(--pen)" strokeWidth="2" strokeLinejoin="round" />
          <rect x="3" y="23" width="6" height="6" fill="var(--ink)" />
        </svg>
        <h1 className="brand__name">SKYGRID</h1>
        <span className="brand__rule" aria-hidden="true" />
        <p className="brand__tag">Planejamento de entregas por drone</p>
      </div>

      <div className="topbar__right">
        {simulation && (
          <span className="clock data" title="Relógio da simulação">
            <i
              className={`clock__dot ${simulation.running ? 'is-running' : ''}`}
              aria-hidden="true"
            />
            {formatMinutes(simulation.clockMinutes)}
            <em>
              {simulation.activeFlights} em voo · {simulation.ordersDelivered} entregues
            </em>
          </span>
        )}

        <span className={`status ${online ? 'status--on' : 'status--off'}`}>
          <i aria-hidden="true" />
          <span className="data">
            {online
              ? lastSync
                ? `atualizado ${lastSync.toLocaleTimeString('pt-BR', { hour12: false })}`
                : 'conectado'
              : 'sem conexão'}
          </span>
        </span>

        <button className="btn btn--quiet" onClick={toggle} disabled={busy || !simulation}>
          {simulation?.running ? 'Pausar' : 'Retomar'}
        </button>
        <button
          className="btn btn--quiet"
          onClick={() => run(api.resetSimulation, 'Simulação reiniciada')}
          disabled={busy || !simulation}
        >
          Reiniciar
        </button>
        <button className="btn btn--quiet" onClick={onRefresh}>
          Atualizar
        </button>
      </div>
    </header>
  );
}
