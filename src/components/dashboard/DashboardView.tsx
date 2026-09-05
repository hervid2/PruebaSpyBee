'use client';
/**
 * Top-level dashboard composition. Lays out every analytics section in order
 * and owns the cross-section `riskFilter` state so clicking a risk indicator
 * filters the critical-issues table below it. Also mounts the page modals.
 */
import { useState } from 'react';
import { motion } from 'motion/react';
import { useRevealVariants } from '@/hooks/useRevealVariants';
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
import ExportConnectModal from '@/components/modals/export/ExportConnectModal';
import type { RiskFilter } from './RiskIndicators';
import styles from './DashboardView.module.scss';

export default function DashboardView() {
  const [riskFilter, setRiskFilter] = useState<RiskFilter>(null);
  const reveal = useRevealVariants();
  // Sections below the fold reveal on scroll (`whileInView`) rather than on
  // mount, so the entrance is actually visible instead of finishing
  // off-screen before the user scrolls to it. `once: true` keeps it from
  // replaying every time a section re-enters the viewport.
  const viewport = { once: true, amount: 0.2 } as const;

  return (
    <div className={styles.view}>
      <DashboardHeader />

      <div className={styles.content}>
        {/* Key metrics (KPIs) */}
        <KeyMetricsRow />

        {/* Status and priority breakdown */}
        <motion.div
          className={styles.section}
          variants={reveal}
          initial="hidden"
          whileInView="visible"
          viewport={viewport}
        >
          <StatusChartsRow />
        </motion.div>

        {/* Created vs. closed trend */}
        <motion.div
          className={styles.section}
          variants={reveal}
          initial="hidden"
          whileInView="visible"
          viewport={viewport}
        >
          <TrendAreaChart />
        </motion.div>

        {/* Risk indicators — drive the riskFilter for the table below */}
        <motion.div
          className={styles.riskRow}
          variants={reveal}
          initial="hidden"
          whileInView="visible"
          viewport={viewport}
        >
          <RiskIndicators activeFilter={riskFilter} onFilterChange={setRiskFilter} />
        </motion.div>

        {/* Critical issues table (reacts to the selected risk filter) */}
        <motion.div
          className={styles.section}
          variants={reveal}
          initial="hidden"
          whileInView="visible"
          viewport={viewport}
        >
          <CriticalIssuesList riskFilter={riskFilter} />
        </motion.div>

        {/* Heatmap + daily activity */}
        <motion.div
          className={styles.section}
          variants={reveal}
          initial="hidden"
          whileInView="visible"
          viewport={viewport}
        >
          <HeatmapSection />
        </motion.div>

        {/* Distribution by category and tag */}
        <motion.div
          className={styles.section}
          variants={reveal}
          initial="hidden"
          whileInView="visible"
          viewport={viewport}
        >
          <DistributionCharts />
        </motion.div>

        {/* Team performance */}
        <motion.div
          className={styles.section}
          variants={reveal}
          initial="hidden"
          whileInView="visible"
          viewport={viewport}
        >
          <TeamPerformance />
        </motion.div>
      </div>

      <DashboardFiltersModal />
      <CreateIssueModal />
      <ExportConnectModal />
    </div>
  );
}
