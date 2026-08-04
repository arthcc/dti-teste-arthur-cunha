import { useMemo } from 'react';
import { formatMinutes, PRIORITY_LABEL } from '../api/config';
import { sortDeliveryQueue, stageLabel, trackOrder } from '../api/tracking';
import type { DroneStatus, Order, RoutePlan } from '../api/types';

interface Props {
  orders: Order[];
  drones: DroneStatus[];
  plan: RoutePlan | null;
  onSelectDrone: (id: string | null) => void;
}

export function DeliveryQueue({ orders, drones, plan, onSelectDrone }: Props) {
  const trackingById = useMemo(
    () => new Map(orders.map((o) => [o.id, trackOrder(o, drones, plan)])),
    [orders, drones, plan],
  );

  const sorted = useMemo(() => sortDeliveryQueue(orders), [orders]);

  return (
    <section className="sheet">
      <header className="sheet__head sheet__head--row">
        <div>
          <span className="label">prioridade, depois ordem de chegada</span>
          <h2>Fila de entregas</h2>
        </div>
        <span className="label">{orders.length} pedidos</span>
      </header>

      {sorted.length === 0 ? (
        <p className="empty">
          A fila está vazia. Registre um pedido para vê-lo entrar na sequência por prioridade.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">prioridade</th>
                <th scope="col">destino</th>
                <th className="table__num" scope="col">
                  peso
                </th>
                <th className="table__num" scope="col">
                  tempo
                </th>
                <th scope="col">acompanhamento</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((o, i) => {
                const track = trackingById.get(o.id)!;
                const clickable = track.droneId !== null;
                return (
                  <tr
                    key={o.id}
                    className={`${clickable ? 'is-clickable' : ''} ${
                      track.stage === 'delivered' ? 'is-done' : ''
                    }`}
                    onClick={() => track.droneId && onSelectDrone(track.droneId)}
                    tabIndex={clickable ? 0 : undefined}
                    role={clickable ? 'button' : undefined}
                    onKeyDown={(e) => {
                      if (track.droneId && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onSelectDrone(track.droneId);
                      }
                    }}
                  >
                    <td className="data table__idx">{String(i + 1).padStart(2, '0')}</td>
                    <td>
                      <span className="prio">
                        <i className={`swatch swatch--${o.priority}`} aria-hidden="true" />
                        {PRIORITY_LABEL[o.priority]}
                      </span>
                    </td>
                    <td className="data">
                      ({o.location.x}, {o.location.y})
                    </td>
                    <td className="data table__num">{o.weightKg} kg</td>
                    <td className="data table__num">
                      {track.etaMinutes !== null
                        ? `~${formatMinutes(track.etaMinutes)}`
                        : formatMinutes(o.deliveryMinutes)}
                    </td>
                    <td>
                      <span className={`tag tag--${track.stage}`}>
                        {stageLabel(track.stage)}
                      </span>
                      {track.droneName && (
                        <span className="tag tag--drone">{track.droneName}</span>
                      )}
                      <span className="reason">{track.message}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
