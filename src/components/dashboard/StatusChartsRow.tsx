'use client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import styles from './StatusChartsRow.module.scss';

const STATUS_COLORS: Record<string, string> = {
  open: '#34C759',
  on_pause: '#F5A623',
  closed: '#E5484D',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Abierta',
  on_pause: 'Pausada',
  closed: 'Cerrada',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: '#E5484D',
  medium: '#F5A623',
  low: '#34C759',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

function DonutChart({
  title,
  data,
  colorMap,
  labelMap,
}: {
  title: string;
  data: { key: string; count: number }[];
  colorMap: Record<string, string>;
  labelMap: Record<string, string>;
}) {
  const chartData = data.map((d) => ({ name: labelMap[d.key] ?? d.key, value: d.count }));
  const total = chartData.reduce((acc, d) => acc + d.value, 0);
  const colors = data.map((d) => colorMap[d.key] ?? '#8A8F98');

  return (
    <div className={styles.chart}>
      <h3 className={styles.chart__title}>{title}</h3>
      <div className={styles.chart__inner}>
        <div className={styles.chart__pie}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                aria-label={title}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={colors[i]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => {
                  const v = typeof value === 'number' ? value : 0;
                  return [`${v} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`, ''];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.chart__legend}>
          {chartData.map((d, i) => (
            <div key={d.name} className={styles.legend__item}>
              <span className={styles.legend__dot} style={{ background: colors[i] }} />
              <span className={styles.legend__label}>{d.name}</span>
              <span className={styles.legend__count}>{d.value}</span>
            </div>
          ))}
          <div className={styles.legend__total}>
            <span>Total</span>
            <span>{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StatusChartsRow() {
  const { byStatus, byPriority } = useDashboardMetrics();

  const statusData = byStatus.map((s) => ({ key: s.status, count: s.count }));
  const priorityData = byPriority.map((p) => ({ key: p.priority, count: p.count }));

  return (
    <section className={styles.row} aria-label="Distribución por estado y prioridad">
      <DonutChart
        title="Por estado"
        data={statusData}
        colorMap={STATUS_COLORS}
        labelMap={STATUS_LABELS}
      />
      <DonutChart
        title="Por prioridad"
        data={priorityData}
        colorMap={PRIORITY_COLORS}
        labelMap={PRIORITY_LABELS}
      />
    </section>
  );
}
