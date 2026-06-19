'use client';
/**
 * Two distribution visualizations: a radar chart of incidents per category and
 * a treemap of incidents per tag. Both read the top-N aggregates from the
 * metrics hook and degrade gracefully to an empty state when there is no data.
 */
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Treemap,
} from 'recharts';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import styles from './DistributionCharts.module.scss';

interface TreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  value?: number;
  fill?: string;
}

/** Custom treemap cell: colored rect with name/value labels when it fits. */
function TreemapContent({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name = '',
  value = 0,
  fill = '#3b82f6',
}: TreemapContentProps) {
  if (width < 30 || height < 20) return null; // skip labels on tiny cells
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} opacity={0.85} />
      {width > 60 && height > 32 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 6}
            textAnchor="middle"
            fill="#fff"
            fontSize={11}
            fontWeight={600}
          >
            {name.length > 14 ? name.slice(0, 13) + '…' : name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 8}
            textAnchor="middle"
            fill="rgba(255,255,255,0.7)"
            fontSize={10}
          >
            {value}
          </text>
        </>
      )}
    </g>
  );
}

export default function DistributionCharts() {
  const metrics = useDashboardMetrics();

  const radarData = metrics.byType.slice(0, 8).map((t) => ({
    subject: t.typeName,
    count: t.count,
    fullMark: Math.max(...metrics.byType.map((x) => x.count), 1),
  }));

  const treemapData = metrics.byTag.slice(0, 20).map((t) => ({
    name: t.tagName,
    size: t.count,
    fill: t.tagColor || '#3b82f6',
  }));

  return (
    <section className={styles.distribution} aria-labelledby="distribution-title">
      <h2 id="distribution-title" className={styles.distribution__title}>
        Distribución detallada — Por tipo y etiqueta
      </h2>
      <div className={styles.distribution__charts}>
        <div className={styles.distribution__chart}>
          <h3 className={styles.distribution__chart_title}>Por categoría de incidencia</h3>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="#e2e4e8" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#8a8f98' }} />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 'auto']}
                  tick={{ fontSize: 9, fill: '#8a8f98' }}
                  tickCount={4}
                />
                <Radar
                  name="Incidencias"
                  dataKey="count"
                  stroke="#f2b705"
                  fill="#f2b705"
                  fillOpacity={0.35}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e4e8' }}
                  formatter={(v) => [v, 'Incidencias']}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className={styles.distribution__empty}>Sin datos para el período seleccionado</p>
          )}
        </div>

        <div className={styles.distribution__chart}>
          <h3 className={styles.distribution__chart_title}>Por etiqueta</h3>
          {treemapData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <Treemap
                data={treemapData}
                dataKey="size"
                nameKey="name"
                content={<TreemapContent />}
              />
            </ResponsiveContainer>
          ) : (
            <p className={styles.distribution__empty}>Sin etiquetas registradas</p>
          )}
        </div>
      </div>
    </section>
  );
}
