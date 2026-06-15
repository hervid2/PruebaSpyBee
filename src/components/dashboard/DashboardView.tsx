'use client';
import { useState } from 'react';
import DashboardHeader from './DashboardHeader';
import KeyMetricsRow from './KeyMetricsRow';
import StatusChartsRow from './StatusChartsRow';
import TrendAreaChart from './TrendAreaChart';
import RiskIndicators from './RiskIndicators';
import CriticalIssuesList from './CriticalIssuesList';
import DashboardFiltersModal from './DashboardFiltersModal';
import CreateIssueModal from '@/components/modals/create-issue/CreateIssueModal';
import type { RiskFilter } from './RiskIndicators';
import styles from './DashboardView.module.scss';

export default function DashboardView() {
  const [riskFilter, setRiskFilter] = useState<RiskFilter>(null);

  return (
    <div className={styles.view}>
      <DashboardHeader />

      <main className={styles.content}>
        <KeyMetricsRow />

        <div className={styles.section}>
          <StatusChartsRow />
        </div>

        <div className={styles.section}>
          <TrendAreaChart />
        </div>

        <div className={styles.riskRow}>
          <RiskIndicators activeFilter={riskFilter} onFilterChange={setRiskFilter} />
        </div>

        <div className={styles.section}>
          <CriticalIssuesList riskFilter={riskFilter} />
        </div>
      </main>

      <DashboardFiltersModal />
      <CreateIssueModal />
    </div>
  );
}
