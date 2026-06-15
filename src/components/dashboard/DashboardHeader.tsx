'use client';
import { Filter, Plus, ChevronRight } from 'lucide-react';
import { useFiltersStore } from '@/store/useFiltersStore';
import { useModalStore } from '@/store/useModalStore';
import type { DashboardPeriod } from '@/domain/models/filters.model';
import styles from './DashboardHeader.module.scss';

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: '90d', label: 'Últimos 90 días' },
];

export default function DashboardHeader() {
  const period = useFiltersStore((s) => s.dashboardFilters.period);
  const setDashboardFilters = useFiltersStore((s) => s.setDashboardFilters);
  const openModal = useModalStore((s) => s.open);

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <span className={styles.breadcrumb__item}>Mis Proyectos</span>
          <ChevronRight size={14} className={styles.breadcrumb__sep} aria-hidden />
          <span className={styles.breadcrumb__item}>Proyecto Onboarding</span>
          <ChevronRight size={14} className={styles.breadcrumb__sep} aria-hidden />
          <span className={styles['breadcrumb__item--active']}>Incidencias</span>
        </nav>

        <div className={styles.actions}>
          <div className={styles.period}>
            {PERIODS.map(({ value, label }) => (
              <button
                key={value}
                className={`${styles.period__btn} ${period === value ? styles['period__btn--active'] : ''}`}
                onClick={() => setDashboardFilters({ period: value })}
                aria-pressed={period === value}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            className={styles.btn}
            onClick={() => openModal('dashboard-filters')}
            aria-label="Abrir filtros avanzados"
          >
            <Filter size={16} />
            <span>Filtros</span>
          </button>

          <button
            className={`${styles.btn} ${styles['btn--primary']}`}
            onClick={() => openModal('create-issue')}
            aria-label="Crear nueva incidencia"
          >
            <Plus size={16} />
            <span>Crear Incidencia</span>
          </button>
        </div>
      </div>

      <div className={styles.meta}>
        <h1 className={styles.meta__title}>Incidencias</h1>
        <p className={styles.meta__subtitle}>Resumen general · Indicadores clave del período</p>
      </div>
    </header>
  );
}
