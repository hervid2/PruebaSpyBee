'use client';
/**
 * Clickable risk chips (overdue, stale, high-priority, due-soon) with live
 * counts. Acts as a controlled segmented filter: selecting a chip lifts the
 * choice to {@link DashboardView}, which narrows the critical-issues table.
 */
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'motion/react';
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
    labelKey: 'riskChipOverdueToday',
    icon: AlertTriangle,
    color: '#E5484D',
  },
  {
    key: 'staleSince7d' as const,
    labelKey: 'riskChipStaleSince7d',
    icon: Clock,
    color: '#F5A623',
  },
  {
    key: 'highPriorityOpen' as const,
    labelKey: 'riskChipHighPriorityOpen',
    icon: Flame,
    color: '#E5484D',
  },
  {
    key: 'dueWithin7d' as const,
    labelKey: 'riskChipDueWithin7d',
    icon: CalendarClock,
    color: '#3B82F6',
  },
] as const;

interface Props {
  activeFilter: RiskFilter;
  onFilterChange: (key: RiskFilter) => void;
}

export default function RiskIndicators({ activeFilter, onFilterChange }: Props) {
  const t = useTranslations('dashboard');
  const { risk } = useDashboardMetrics();
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className={styles.section} aria-label={t('riskTitle')}>
      <h2 className={styles.title}>{t('riskTitle')}</h2>
      <div className={styles.chips}>
        {CHIPS.map(({ key, labelKey, icon: Icon, color }) => {
          const count = risk[key];
          const isActive = activeFilter === key;
          return (
            <motion.button
              key={key}
              className={`${styles.chip} ${isActive ? styles['chip--active'] : ''}`}
              style={{ '--chip-color': color } as React.CSSProperties}
              onClick={() => onFilterChange(isActive ? null : key)}
              aria-pressed={isActive}
              whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
              transition={{ duration: 0.15 }}
            >
              <Icon size={14} className={styles.chip__icon} aria-hidden />
              <span className={styles.chip__label}>{t(labelKey)}</span>
              <span className={styles.chip__count}>{count}</span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
