import { useMemo } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMinutes, PRIORITY_LABEL } from '../api/config';
import type { Order, Priority, RoutePlan, SimulationState } from '../api/types';
import { C, PRIORITY_BAR_FILL, PRIORITY_HEX } from '../theme';

interface Props {
  orders: Order[];
  plan: RoutePlan | null;
  simulation: SimulationState | null;
}

const PRIORITIES: Priority[] = ['high', 'medium', 'low'];

function avgOccupancyOf(plan: RoutePlan | null) {
  const trips = plan?.trips ?? [];
  if (!trips.length) return 0;
  return Math.round(trips.reduce((s, t) => s + t.occupancyPercent, 0) / trips.length);
}

function Figure({
  label,
  value,
  unit,
  alert,
}: {
  label: string;
  value: string | number;
  unit?: string;
  alert?: boolean;
}) {
  return (
    <div className="figure">
      <span className="label">{label}</span>
      <span className={`figure__value data ${alert ? 'figure__value--alert' : ''}`}>
        {value}
        {unit && <em className="figure__unit">{unit}</em>}
      </span>
    </div>
  );
}

export function PlanFigures({ plan }: { plan: RoutePlan | null }) {
  const unassigned = plan?.unassigned.length ?? 0;
  return (
    <div className="figures">
      <Figure label="viagens" value={plan?.totalTrips ?? 0} />
      <Figure label="pedidos em rota" value={plan?.totalAssignedOrders ?? 0} />
      <Figure label="sem alocação" value={unassigned} alert={unassigned > 0} />
      <Figure label="distância" value={(plan?.totalDistanceKm ?? 0).toFixed(1)} unit="km" />
      <Figure label="tempo do plano" value={formatMinutes(plan?.makespanMinutes ?? 0)} />
      <Figure label="ocupação média" value={avgOccupancyOf(plan)} unit="%" />
    </div>
  );
}

function ChartTooltip({ active, payload, label, suffix }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip data">
      <strong>{label}</strong>
      <span>
        {payload[0].value}
        {suffix}
      </span>
    </div>
  );
}

const TICK = { fill: C.ink3, fontSize: 10, fontFamily: 'IBM Plex Mono' };

export function Dashboard({ orders, plan, simulation }: Props) {
  const byPriority = useMemo(
    () =>
      PRIORITIES.map((p) => ({
        name: PRIORITY_LABEL[p].toLowerCase(),
        value: orders.filter((o) => o.priority === p).length,
        color: PRIORITY_HEX[p],
        fill: PRIORITY_BAR_FILL[p],
      })),
    [orders],
  );

  const perDrone = useMemo(
    () =>
      (plan?.trips ?? []).map((t) => ({
        name: t.droneName,
        occ: t.occupancyPercent,
      })),
    [plan],
  );

  const best = useMemo(() => {
    if (!plan?.trips.length) return null;
    return [...plan.trips].sort(
      (a, b) => b.occupancyPercent - a.occupancyPercent || b.orders.length - a.orders.length,
    )[0];
  }, [plan]);

  return (
    <section className="sheet">
      <header className="sheet__head">
        <span className="label">eficiência</span>
        <h2>Uso da frota</h2>
      </header>

      <div className="figures figures--inline">
        <Figure label="tempo total das viagens" value={formatMinutes(plan?.totalTimeMinutes ?? 0)} />
        <Figure label="tempo até a última entrega" value={formatMinutes(plan?.makespanMinutes ?? 0)} />
        <Figure label="entregas concluídas" value={simulation?.ordersDelivered ?? 0} />
        <Figure
          label="tempo médio realizado"
          value={formatMinutes(simulation?.averageDeliveryMinutes)}
        />
      </div>

      <div className="charts">
        <div className="chart">
          <span className="label chart__title">ocupação por viagem</span>
          {perDrone.length ? (
            <ResponsiveContainer width="100%" height={148}>
              <BarChart data={perDrone} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={{ stroke: C.rule2 }} />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 50, 100]}
                  tick={TICK}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip cursor={{ fill: C.inset }} content={<ChartTooltip suffix="%" />} />
                <Bar dataKey="occ" maxBarSize={34}>
                  {perDrone.map((_, i) => (
                    <Cell key={i} fill={C.ink} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty">Nenhuma viagem planejada ainda.</p>
          )}
        </div>

        <div className="chart">
          <span className="label chart__title">pedidos por prioridade</span>
          {orders.length ? (
            <ResponsiveContainer width="100%" height={148}>
              <BarChart
                layout="vertical"
                data={byPriority}
                margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={48}
                  tick={TICK}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip cursor={{ fill: C.inset }} content={<ChartTooltip suffix="" />} />
                <Bar dataKey="value" maxBarSize={20}>
                  {byPriority.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.fill}
                      stroke={d.color}
                      strokeWidth={d.fill === d.color ? 0 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty">Nenhum pedido registrado.</p>
          )}
        </div>
      </div>

      <footer className="sheet__foot">
        <span className="label">melhor aproveitamento</span>
        {best ? (
          <p className="best data">
            {best.droneName}
            <span>
              {' '}
              · {best.occupancyPercent}% da capacidade · {best.orders.length} entregas ·{' '}
              {formatMinutes(best.totalMinutes)}
            </span>
          </p>
        ) : (
          <p className="best best--empty">Sem viagens para comparar.</p>
        )}
        <p className="note">
          O tempo do plano soma carregamento, voo e paradas nos clientes. O tempo médio realizado
          vem do relógio da simulação, que consome bateria por distância percorrida e por tempo de
          motor ligado.
        </p>
      </footer>
    </section>
  );
}
