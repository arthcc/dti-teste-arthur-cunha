import { useMemo, useState, type CSSProperties } from 'react';
import { GRID_SIZE, DRONE_STATE_LABEL, PRIORITY_LABEL } from '../api/config';
import { queuePosition, stageLabel, trackOrder } from '../api/tracking';
import type { DroneStatus, NoFlyZone, Order, RoutePlan } from '../api/types';
import { C, PRIORITY_HEX, PRIORITY_MARK } from '../theme';

const SPAN = 470;
const PAD = { l: 38, r: 16, t: 16, b: 30 };
const W = PAD.l + SPAN + PAD.r;
const H = PAD.t + SPAN + PAD.b;

const AXIS_X = PAD.l;
const AXIS_Y = PAD.t + SPAN;

type Hover =
  | { kind: 'order'; order: Order }
  | { kind: 'drone'; drone: DroneStatus }
  | null;

interface Props {
  drones: DroneStatus[];
  orders: Order[];
  plan: RoutePlan | null;
  zones: NoFlyZone[];
  selectedDroneId: string | null;
}

function project(x: number, y: number) {
  return {
    px: PAD.l + (x / GRID_SIZE) * SPAN,
    py: PAD.t + SPAN - (y / GRID_SIZE) * SPAN,
  };
}

const HALF = SPAN / GRID_SIZE / 2;

function tipStyle(px: number, py: number): CSSProperties {
  const x = px < W * 0.24 ? '-8px' : px > W * 0.76 ? 'calc(-100% + 8px)' : '-50%';
  const y = py < H * 0.32 ? '18px' : 'calc(-100% - 18px)';
  return {
    left: `${(px / W) * 100}%`,
    top: `${(py / H) * 100}%`,
    transform: `translate(${x}, ${y})`,
  };
}

export function CityGrid({ drones, orders, plan, zones, selectedDroneId }: Props) {
  const [hover, setHover] = useState<Hover>(null);

  const units = useMemo(() => Array.from({ length: GRID_SIZE + 1 }, (_, i) => i), []);
  const majors = useMemo(() => units.filter((i) => i % 5 === 0), [units]);
  const positions = useMemo(() => queuePosition(orders), [orders]);

  const base = project(0, 0);
  const idleCount = drones.filter((d) => d.state === 'idle').length;
  const flying = drones.filter((d) => d.state !== 'idle');

  const routePath = (trip: RoutePlan['trips'][number]) =>
    trip.path
      .map((p, i) => {
        const { px, py } = project(p.x, p.y);
        return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`;
      })
      .join(' ');

  const fleetMarks = (() => {
    const taken = [{ x: base.px + 46, y: base.py - 8 }];
    return flying.map((d) => {
      const { px, py } = project(d.position.x, d.position.y);
      const clear = taken.every((t) => Math.hypot(t.x - px, t.y - py) > 34);
      if (clear) taken.push({ x: px, y: py });
      return { drone: d, px, py, labelled: clear };
    });
  })();

  const selectedTrip = plan?.trips.find((t) => t.droneId === selectedDroneId) ?? null;
  const hoveredOrder = hover?.kind === 'order' ? hover.order : null;
  const hoverPoint = hoveredOrder
    ? project(hoveredOrder.location.x, hoveredOrder.location.y)
    : null;

  return (
    <div className="plot">
      <div className="plot__canvas">
        <svg
          className="plot__sheet"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Malha de entregas com base, pedidos, zonas de exclusão e rotas planejadas"
        >
          <defs>
            <pattern
              id="nofly"
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="7" height="7" fill="#fdf7f6" />
              <line x1="0" y1="0" x2="0" y2="7" stroke={C.alert} strokeWidth="1" opacity="0.24" />
            </pattern>
          </defs>

          {units.map((i) => {
            const p = PAD.l + (i / GRID_SIZE) * SPAN;
            const q = PAD.t + (i / GRID_SIZE) * SPAN;
            const major = i % 5 === 0;
            return (
              <g
                key={i}
                stroke={major ? C.rule : C.hair}
                strokeWidth="1"
                shapeRendering="crispEdges"
              >
                <line x1={p} y1={PAD.t} x2={p} y2={AXIS_Y} />
                <line x1={PAD.l} y1={q} x2={PAD.l + SPAN} y2={q} />
              </g>
            );
          })}

          {zones.map((z) => {
            const a = project(z.minX, z.maxY);
            const b = project(z.maxX, z.minY);
            return (
              <g key={z.id}>
                <rect
                  x={a.px - HALF}
                  y={a.py - HALF}
                  width={b.px - a.px + HALF * 2}
                  height={b.py - a.py + HALF * 2}
                  fill="url(#nofly)"
                  stroke={C.alert}
                  strokeWidth="1"
                  strokeDasharray="3 2"
                  strokeOpacity="0.5"
                />
                <title>{`${z.name} — zona de exclusão aérea`}</title>
              </g>
            );
          })}

          <rect
            x={PAD.l}
            y={PAD.t}
            width={SPAN}
            height={SPAN}
            fill="none"
            stroke={C.rule2}
            strokeWidth="1"
            shapeRendering="crispEdges"
          />

          <g fontFamily="var(--font-data)" fontSize="10" fill={C.ink3}>
            {majors.map((t) => {
              const px = PAD.l + (t / GRID_SIZE) * SPAN;
              const py = AXIS_Y - (t / GRID_SIZE) * SPAN;
              const onX = hoveredOrder?.location.x === t;
              const onY = hoveredOrder?.location.y === t;
              return (
                <g key={t}>
                  <text x={px} y={AXIS_Y + 17} textAnchor="middle" fill={onX ? C.ink : C.ink3}>
                    {t}
                  </text>
                  <text x={PAD.l - 11} y={py + 3.5} textAnchor="end" fill={onY ? C.ink : C.ink3}>
                    {t}
                  </text>
                </g>
              );
            })}
          </g>

          {plan?.trips.map((trip) => {
            if (trip.droneId === selectedDroneId) return null;
            return (
              <path
                key={trip.droneId}
                d={routePath(trip)}
                fill="none"
                stroke={C.penSoft}
                strokeWidth="1"
                strokeLinejoin="round"
                opacity={selectedDroneId ? 0.35 : 1}
              />
            );
          })}

          {selectedTrip && (
            <path
              key={selectedTrip.droneId}
              className="route-drawn"
              d={routePath(selectedTrip)}
              pathLength={1}
              fill="none"
              stroke={C.pen}
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {orders.map((o) => {
            const { px, py } = project(o.location.x, o.location.y);
            const isHover = hoveredOrder?.id === o.id;
            const done = o.status === 'delivered';
            const color = PRIORITY_HEX[o.priority];
            const { r, hollow } = PRIORITY_MARK[o.priority];
            const radius = (done ? 3 : r) + (isHover ? 1.4 : 0);
            return (
              <g
                key={o.id}
                transform={`translate(${px} ${py})`}
                className="pin"
                onMouseEnter={() => setHover({ kind: 'order', order: o })}
                onMouseLeave={() =>
                  setHover((h) => (h?.kind === 'order' && h.order.id === o.id ? null : h))
                }
              >
                <circle r="10" fill="transparent" />
                <circle r={radius + 1.6} fill={C.paper} />
                <circle
                  r={radius}
                  fill={done ? C.ink4 : hollow ? C.paper : color}
                  stroke={color}
                  strokeWidth={!done && hollow ? 1.5 : 0}
                  opacity={done ? 0.7 : 1}
                />
                {isHover && (
                  <circle
                    r={radius + 4}
                    fill="none"
                    stroke={done ? C.ink3 : color}
                    strokeWidth="0.9"
                    opacity="0.45"
                  />
                )}
              </g>
            );
          })}

          {hoveredOrder && hoverPoint && (
            <g
              stroke={C.ink}
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity="0.5"
              pointerEvents="none"
            >
              <line x1={AXIS_X} y1={hoverPoint.py} x2={hoverPoint.px} y2={hoverPoint.py} />
              <line x1={hoverPoint.px} y1={hoverPoint.py} x2={hoverPoint.px} y2={AXIS_Y} />
            </g>
          )}

          {selectedTrip?.route.map((p, i) => {
            const { px, py } = project(p.x, p.y);
            const bx = px + 9.5;
            const by = py - 9.5;
            return (
              <g key={`${p.x}-${p.y}-${i}`} pointerEvents="none">
                <circle cx={bx} cy={by} r="7.4" fill={C.paper} stroke={C.pen} strokeWidth="1.1" />
                <text
                  x={bx}
                  y={by + 3}
                  textAnchor="middle"
                  fontFamily="var(--font-data)"
                  fontSize="8.5"
                  fontWeight="600"
                  fill={C.pen}
                >
                  {i + 1}
                </text>
              </g>
            );
          })}

          {fleetMarks.map(({ drone: d, px, py, labelled }) => {
            const isHover = hover?.kind === 'drone' && hover.drone.id === d.id;
            const tint = d.batteryPercent < 20 ? C.alert : C.pen;
            const labelRight = px < W - 96;
            return (
              <g
                key={d.id}
                transform={`translate(${px} ${py})`}
                className="pin"
                onMouseEnter={() => setHover({ kind: 'drone', drone: d })}
                onMouseLeave={() =>
                  setHover((h) => (h?.kind === 'drone' && h.drone.id === d.id ? null : h))
                }
              >
                <circle r="13" fill="transparent" />
                <circle r={isHover ? 10 : 9} fill={C.paper} />
                <rect
                  x="-4.6"
                  y="-4.6"
                  width="9.2"
                  height="9.2"
                  rx="1.4"
                  transform="rotate(45)"
                  fill={tint}
                />
                {(labelled || isHover) && (
                  <text
                    x={labelRight ? 12 : -12}
                    y="3.4"
                    textAnchor={labelRight ? 'start' : 'end'}
                    fontFamily="var(--font-data)"
                    fontSize="9.5"
                    fill={C.ink2}
                    stroke={C.paper}
                    strokeWidth="2.6"
                    strokeLinejoin="round"
                    paintOrder="stroke"
                  >
                    {d.name}
                  </text>
                )}
              </g>
            );
          })}

          <g pointerEvents="none">
            <rect x={base.px - 4.5} y={base.py - 4.5} width="9" height="9" fill={C.ink} />
            <text
              x={base.px + 12}
              y={base.py - 8}
              fontFamily="var(--font-data)"
              fontSize="10"
              fill={C.ink2}
              stroke={C.paper}
              strokeWidth="2.6"
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              base{idleCount > 0 ? ` · ${idleCount} em espera` : ''}
            </text>
          </g>
        </svg>

        {hover?.kind === 'order' &&
          (() => {
            const o = hover.order;
            const t = trackOrder(o, drones, plan);
            const { px, py } = project(o.location.x, o.location.y);
            return (
              <div className="mark-tip" style={tipStyle(px, py)}>
                <span className="mark-tip__head">
                  <b className="data">#{String(positions.get(o.id) ?? 0).padStart(2, '0')}</b>
                  <span className="prio">
                    <i className={`swatch swatch--${o.priority}`} aria-hidden="true" />
                    {PRIORITY_LABEL[o.priority]}
                  </span>
                </span>
                <span className="mark-tip__data data">
                  ({o.location.x}, {o.location.y}) · {o.weightKg} kg
                </span>
                <span className="mark-tip__stage">
                  {stageLabel(t.stage)}
                  {t.droneName ? ` · ${t.droneName}` : ''}
                </span>
                <span className="mark-tip__note">{t.message}</span>
              </div>
            );
          })()}

        {hover?.kind === 'drone' &&
          (() => {
            const d = hover.drone;
            const { px, py } = project(d.position.x, d.position.y);
            return (
              <div className="mark-tip" style={tipStyle(px, py)}>
                <span className="mark-tip__head">
                  <b>{d.name}</b>
                </span>
                <span className="mark-tip__stage">
                  {DRONE_STATE_LABEL[d.state]} · bateria {d.batteryPercent.toFixed(0)}%
                </span>
                <span className="mark-tip__data data">
                  ({d.position.x.toFixed(1)}, {d.position.y.toFixed(1)}) · restam{' '}
                  {d.remainingRangeKm.toFixed(1)} km
                </span>
                <span className="mark-tip__note">
                  {d.capacityKg} kg · {d.speedKmh} km/h · {d.deliveriesCompleted} entregas
                </span>
              </div>
            );
          })()}
      </div>

      <div className="plot__foot">
        <ul className="legend">
          <li>
            <i className="swatch swatch--base" /> base
          </li>
          <li>
            <i className="swatch swatch--drone" /> drone
          </li>
          <li>
            <i className="swatch swatch--high" /> alta
          </li>
          <li>
            <i className="swatch swatch--medium" /> média
          </li>
          <li>
            <i className="swatch swatch--low" /> baixa
          </li>
          <li>
            <i className="swatch swatch--done" /> entregue
          </li>
          {zones.length > 0 && (
            <li>
              <i className="swatch swatch--nofly" /> exclusão
            </li>
          )}
        </ul>

        <p className="readout data" aria-live="polite">
          {hover?.kind === 'order'
            ? `#${String(positions.get(hover.order.id) ?? 0).padStart(2, '0')}  x ${
                hover.order.location.x
              }  y ${hover.order.location.y}  ·  ${hover.order.weightKg} kg  ·  ${PRIORITY_LABEL[
                hover.order.priority
              ].toLowerCase()}`
            : hover?.kind === 'drone'
              ? `${hover.drone.name}  ·  ${DRONE_STATE_LABEL[
                  hover.drone.state
                ].toLowerCase()}  ·  ${hover.drone.batteryPercent.toFixed(0)}%`
              : ''}
        </p>
      </div>
    </div>
  );
}
