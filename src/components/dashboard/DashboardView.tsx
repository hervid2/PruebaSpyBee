'use client';
import { useState } from 'react';
import DashboardHeader from './DashboardHeader';
import KeyMetricsRow from './KeyMetricsRow';
import StatusChartsRow from './StatusChartsRow';
import TrendAreaChart from './TrendAreaChart';
import RiskIndicators from './RiskIndicators';
import CriticalIssuesList from './CriticalIssuesList';
import DashboardFiltersModal from './DashboardFiltersModal';
import HeatmapSection from './HeatmapSection';
import DistributionCharts from './DistributionCharts';
import TeamPerformance from './TeamPerformance';
import CreateIssueModal from '@/components/modals/create-issue/CreateIssueModal';
import type { RiskFilter } from './RiskIndicators';
import styles from './DashboardView.module.scss';

export default function DashboardView() {
  const [riskFilter, setRiskFilter] = useState<RiskFilter>(null);

  return (
    <div className={styles.view}>
      <DashboardHeader />

      <div className={styles.content}>
        {/* KPIs */}
        <KeyMetricsRow />

        {/* Estado y prioridad */}
        <div className={styles.section}>
          <StatusChartsRow />
        </div>

        {/* Tendencia creadas vs cerradas */}
        <div className={styles.section}>
          <TrendAreaChart />
        </div>

        {/* Indicadores de riesgo */}
        <div className={styles.riskRow}>
          <RiskIndicators activeFilter={riskFilter} onFilterChange={setRiskFilter} />
        </div>

        {/* Tabla de incidencias críticas */}
        <div className={styles.section}>
          <CriticalIssuesList riskFilter={riskFilter} />
        </div>

        {/* Mapa de calor + actividad diaria */}
        <div className={styles.section}>
          <HeatmapSection />
        </div>

        {/* Distribución por categoría y etiqueta */}
        <div className={styles.section}>
          <DistributionCharts />
        </div>

        {/* Desempeño del equipo */}
        <div className={styles.section}>
          <TeamPerformance />
        </div>
      </div>

      <DashboardFiltersModal />
      <CreateIssueModal />
    </div>
  );
}
