'use client';
import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO, startOfWeek, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import styles from './TrendAreaChart.module.scss';

type Granularity = 'day' | 'week' | 'month';

function aggregateTrend(
  trend: { date: string; created: number; closed: number; backlog: number }[],
  granularity: Granularity,
) {
  if (trend.length === 0) return [];

  const buckets = new Map<string, { created: number; closed: number }>();

  trend.forEach(({ date, created, closed }) => {
    const d = parseISO(date);
    let key: string;
    if (granularity === 'week') {
      key = format(startOfWeek(d, { locale: es }), 'yyyy-MM-dd');
    } else if (granularity === 'month') {
      key = format(startOfMonth(d), 'yyyy-MM');
    } else {
      key = date;
    }
    const prev = buckets.get(key) ?? { created: 0, closed: 0 };
    buckets.set(key, { created: prev.created + created, closed: prev.closed + closed });
  });

  let backlog = 0;
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { created, closed }]) => {
      backlog += created - closed;
      const label =
        granularity === 'month'
          ? format(parseISO(date + '-01'), 'MMM yyyy', { locale: es })
          : granularity === 'week'
            ? `Sem ${format(parseISO(date), 'd MMM', { locale: es })}`
            : format(parseISO(date), 'd MMM', { locale: es });
      return { date: label, created, closed, backlog };
    });
}

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
];

export default function TrendAreaChart() {
  const { trend } = useDashboardMetrics();
  const [granularity, setGranularity] = useState<Granularity>('day');

  const data = useMemo(() => aggregateTrend(trend, granularity), [trend, granularity]);

  return (
    <section className={styles.section} aria-label="Tendencia de incidencias">
      <div className={styles.header}>
        <h2 className={styles.header__title}>Tendencia: Creadas vs Cerradas</h2>
        <div className={styles.toggle} role="group" aria-label="Granularidad de la tendencia">
          {GRANULARITY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              className={`${styles.toggle__btn} ${granularity === value ? styles['toggle__btn--active'] : ''}`}
              onClick={() => setGranularity(value)}
              aria-pressed={granularity === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <p className={styles.empty}>Sin datos para el período seleccionado.</p>
      ) : (
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradClosed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34C759" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#34C759" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradBacklog" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5A623" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E4E8" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#8A8F98' }}
                tickLine={false}
                axisLine={{ stroke: '#E2E4E8' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#8A8F98' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  border: '1px solid #E2E4E8',
                  borderRadius: 8,
                  fontSize: 13,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              />
              <Area
                type="monotone"
                dataKey="created"
                name="Creadas"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="url(#gradCreated)"
              />
              <Area
                type="monotone"
                dataKey="closed"
                name="Cerradas"
                stroke="#34C759"
                strokeWidth={2}
                fill="url(#gradClosed)"
              />
              <Area
                type="monotone"
                dataKey="backlog"
                name="Backlog acumulado"
                stroke="#F5A623"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="url(#gradBacklog)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
