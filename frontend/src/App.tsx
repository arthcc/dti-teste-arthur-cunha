import { useState } from 'react';
import './App.css';
import { formatMinutes, GRID_SIZE } from './api/config';
import { useFleetData } from './hooks/useFleetData';
import { useDeliveryAlerts } from './hooks/useDeliveryAlerts';
import { CommandBar } from './components/CommandBar';
import { CityGrid } from './components/CityGrid';
import { OrderForm } from './components/OrderForm';
import { FleetPanel } from './components/FleetPanel';
import { ZonePanel } from './components/ZonePanel';
import { DeliveryQueue } from './components/DeliveryQueue';
import { Dashboard, PlanFigures } from './components/Dashboard';

export default function App() {
  const { drones, orders, plan, zones, simulation, limits, loading, error, lastSync, refresh } =
    useFleetData();
  const [selectedDroneId, setSelectedDroneId] = useState<string | null>(null);

  useDeliveryAlerts(orders, drones, plan);

  const selectedTrip = plan?.trips.find((t) => t.droneId === selectedDroneId) ?? null;
  const grid = limits?.gridSize ?? GRID_SIZE;

  return (
    <div className="app">
      <CommandBar
        online={!error}
        lastSync={lastSync}
        simulation={simulation}
        onRefresh={refresh}
      />

      {error && (
        <div className="notice" role="alert">
          <p>
            <strong>Não foi possível falar com a API.</strong> <span className="data">{error}</span>
          </p>
          <button className="btn btn--quiet" onClick={refresh}>
            Tentar de novo
          </button>
        </div>
      )}

      {loading && !plan ? (
        <div className="loading">
          <span className="loading__rule" aria-hidden="true" />
          <p className="label">carregando plano…</p>
        </div>
      ) : (
        <main className="workspace">
          <aside className="workspace__aside">
            <OrderForm limits={limits} zones={zones} onCreated={refresh} />
            <FleetPanel
              drones={drones}
              plan={plan}
              selectedDroneId={selectedDroneId}
              onSelectDrone={setSelectedDroneId}
              onChanged={refresh}
            />
            <ZonePanel zones={zones} limits={limits} onChanged={refresh} />
          </aside>

          <section className="sheet sheet--plot">
            <header className="sheet__head sheet__head--row">
              <div>
                <span className="label">
                  malha {grid} × {grid} · base em (0,0)
                </span>
                <h2>Plano de rotas</h2>
              </div>

              {selectedTrip ? (
                <div className="selection">
                  <span className="label">
                    {selectedTrip.droneName} · {selectedTrip.route.length} paradas ·{' '}
                    {selectedTrip.totalDistanceKm} km · {formatMinutes(selectedTrip.totalMinutes)} ·
                    bateria {selectedTrip.batteryCostPercent}%
                  </span>
                  <button className="btn btn--quiet" onClick={() => setSelectedDroneId(null)}>
                    Limpar seleção
                  </button>
                </div>
              ) : (
                <span className="label">
                  {orders.length} pedidos · {plan?.totalTrips ?? 0} rotas
                  {zones.length > 0 && ` · ${zones.length} zonas`}
                </span>
              )}
            </header>

            <CityGrid
              drones={drones}
              orders={orders}
              plan={plan}
              zones={zones}
              selectedDroneId={selectedDroneId}
            />

            <PlanFigures plan={plan} />
          </section>

          <div className="workspace__lower">
            <DeliveryQueue
              orders={orders}
              drones={drones}
              plan={plan}
              onSelectDrone={setSelectedDroneId}
            />
            <Dashboard orders={orders} plan={plan} simulation={simulation} />
          </div>
        </main>
      )}
    </div>
  );
}
