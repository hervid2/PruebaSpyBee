'use client';
/**
 * Top-level dashboard composition. Lays out every analytics section in order
 * and owns the cross-section `riskFilter` state so clicking a risk indicator
 * filters the critical-issues table below it. Also mounts the page modals.
 */
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
        {/* Key metrics (KPIs) */}
        <KeyMetricsRow />

        {/* Status and priority breakdown */}
        <div className={styles.section}>
          <StatusChartsRow />
        </div>

        {/* Created vs. closed trend */}
        <div className={styles.section}>
          <TrendAreaChart />
        </div>

        {/* Risk indicators — drive the riskFilter for the table below */}
        <div className={styles.riskRow}>
          <RiskIndicators activeFilter={riskFilter} onFilterChange={setRiskFilter} />
        </div>

        {/* Critical issues table (reacts to the selected risk filter) */}
        <div className={styles.section}>
          <CriticalIssuesList riskFilter={riskFilter} />
        </div>

        {/* Heatmap + daily activity */}
        <div className={styles.section}>
          <HeatmapSection />
        </div>

        {/* Distribution by category and tag */}
        <div className={styles.section}>
          <DistributionCharts />
        </div>

        {/* Team performance */}
        <div className={styles.section}>
          <TeamPerformance />
        </div>
      </div>

      <DashboardFiltersModal />
      <CreateIssueModal />
    </div>
  );
}
