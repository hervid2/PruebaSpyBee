'use client';
import { useMemo } from 'react';
import { useIssuesStore } from '@/store/useIssuesStore';
import { useFiltersStore } from '@/store/useFiltersStore';
import { getDashboardMetrics } from '@/domain/selectors/dashboard-metrics.selector';
import type { DashboardMetrics } from '@/domain/models/dashboard-metrics.model';

export function useDashboardMetrics(): DashboardMetrics {
  const incidents = useIssuesStore((s) => s.incidents);
  const dashboardFilters = useFiltersStore((s) => s.dashboardFilters);

  return useMemo(
    () => getDashboardMetrics(incidents, dashboardFilters),
    [incidents, dashboardFilters],
  );
}
