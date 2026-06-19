'use client';
/**
 * Clickable risk chips (overdue, stale, high-priority, due-soon) with live
 * counts. Acts as a controlled segmented filter: selecting a chip lifts the
 * choice to {@link DashboardView}, which narrows the critical-issues table.
 */
import { AlertTriangle, Clock, Flame, CalendarClock } from 'lucide-react';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import styles from './RiskIndicators.module.scss';

/** Selected risk dimension, or `null` when no risk filter is active. */
export type RiskFilter =
  | 'overdueToday'
  | 'staleSince7d'
  | 'highPriorityOpen'
  | 'dueWithin7d'
  | null;

const CHIPS = [
  {
    key: 'overdueToday' as const,
    label: 'Vencidas hoy',
    icon: AlertTriangle,
    color: '#E5484D',
  },
  {
    key: 'staleSince7d' as const,
    label: 'Sin actualizar 7d+',
    icon: Clock,
    color: '#F5A623',
  },
  {
    key: 'highPriorityOpen' as const,
    label: 'Alta prioridad abiertas',
    icon: Flame,
    color: '#E5484D',
  },
  {
    key: 'dueWithin7d' as const,
    label: 'Próximas a vencer (7d)',
    icon: CalendarClock,
    color: '#3B82F6',
  },
] as const;

interface Props {
  activeFilter: RiskFilter;
  onFilterChange: (key: RiskFilter) => void;
}

export default function RiskIndicators({ activeFilter, onFilterChange }: Props) {
  const { risk } = useDashboardMetrics();

  return (
    <section className={styles.section} aria-label="Indicadores de riesgo">
      <h2 className={styles.title}>Indicadores de riesgo</h2>
      <div className={styles.chips}>
        {CHIPS.map(({ key, label, icon: Icon, color }) => {
          const count = risk[key];
          const isActive = activeFilter === key;
          return (
            <button
              key={key}
              className={`${styles.chip} ${isActive ? styles['chip--active'] : ''}`}
              style={{ '--chip-color': color } as React.CSSProperties}
              onClick={() => onFilterChange(isActive ? null : key)}
              aria-pressed={isActive}
            >
              <Icon size={14} className={styles.chip__icon} aria-hidden />
              <span className={styles.chip__label}>{label}</span>
              <span className={styles.chip__count}>{count}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
