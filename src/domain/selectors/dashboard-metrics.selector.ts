/**
 * Pure aggregation layer that turns raw incidents + active filters into the
 * chart-ready {@link DashboardMetrics}. Kept framework-agnostic (no React) so
 * it is trivially unit-testable and reusable; the dashboard hook simply
 * memoizes its output.
 */
import { differenceInDays, isAfter, isBefore, parseISO, format, startOfDay } from 'date-fns';
import type { Incident } from '../models/incident.model';
import type { DashboardFilters } from '../models/filters.model';
import type { DashboardMetrics } from '../models/dashboard-metrics.model';
import { MOCK_USERS } from '@/lib/constants/mock-users';

// Lookup table so company filters resolve in O(1) instead of scanning users.
const USER_COMPANY_MAP = new Map(MOCK_USERS.map((u) => [u.id, u.company]));

/** Resolves the active filter preset into a concrete `[from, to]` date range. */
function getPeriodRange(filters: DashboardFilters): { from: Date; to: Date } {
  const to = startOfDay(new Date());
  if (filters.period === 'custom' && filters.customRange) {
    return { from: parseISO(filters.customRange.from), to: parseISO(filters.customRange.to) };
  }
  if (filters.period === '6m') {
    const from = new Date(to);
    from.setMonth(from.getMonth() - 6);
    return { from, to };
  }
  const daysMap: Record<string, number> = { '7d': 7, '15d': 15, '30d': 30, '90d': 90 };
  const days = daysMap[filters.period] ?? 30;
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from, to };
}

/**
 * Computes every dashboard metric in a single pass over the incident list.
 * @param incidents Full dataset (the selector applies the filters itself).
 * @param filters   Active dashboard filters (status, priority, period…).
 * @returns Aggregated metrics ready to bind directly to the chart components.
 */
export function getDashboardMetrics(
  incidents: Incident[],
  filters: DashboardFilters,
): DashboardMetrics {
  const today = startOfDay(new Date());
  const { from, to } = getPeriodRange(filters);

  // Drop soft-deleted rows, then narrow by each active filter dimension.
  let filtered = incidents.filter((i) => !('deleted' in i && i.deleted));

  if (filters.status?.length) {
    filtered = filtered.filter((i) => filters.status!.includes(i.status));
  }
  if (filters.priority?.length) {
    filtered = filtered.filter((i) => filters.priority!.includes(i.priority));
  }
  if (filters.typeKey?.length) {
    filtered = filtered.filter((i) => filters.typeKey!.includes(i.type.key));
  }
  if (filters.createdByUser?.length) {
    filtered = filtered.filter((i) => filters.createdByUser!.includes(i.owner.id));
  }
  if (filters.responsibleUser?.length) {
    filtered = filtered.filter((i) =>
      i.assignees.some((a) => filters.responsibleUser!.includes(a.id)),
    );
  }
  if (filters.createdByCompany?.length) {
    filtered = filtered.filter((i) => {
      const company = USER_COMPANY_MAP.get(i.owner.id);
      return company !== undefined && filters.createdByCompany!.includes(company);
    });
  }
  if (filters.responsibleByCompany?.length) {
    filtered = filtered.filter((i) =>
      i.assignees.some((a) => {
        const company = USER_COMPANY_MAP.get(a.id);
        return company !== undefined && filters.responsibleByCompany!.includes(company);
      }),
    );
  }

  // Subset created inside the selected window — basis for period-scoped KPIs.
  const inPeriod = filtered.filter((i) => {
    const created = parseISO(i.createdAt);
    return !isBefore(created, from) && !isAfter(created, to);
  });

  // Headline KPIs.
  const openCount = filtered.filter((i) => i.status === 'open').length;
  const createdInPeriod = inPeriod.length;
  const closedInPeriod = inPeriod.filter((i) => i.status === 'closed').length;
  const closureRate =
    createdInPeriod > 0 ? Math.round((closedInPeriod / createdInPeriod) * 100) : 0;

  const closedWithDate = filtered.filter((i) => i.status === 'closed' && i.closingDate);
  const avgResolutionDays =
    closedWithDate.length > 0
      ? Math.round(
          closedWithDate.reduce((acc, i) => {
            const diff = differenceInDays(parseISO(i.closingDate!), parseISO(i.createdAt));
            return acc + Math.max(0, diff);
          }, 0) / closedWithDate.length,
        )
      : null;

  const overdueActiveCount = filtered.filter(
    (i) => i.status === 'open' && i.dueDate && isBefore(parseISO(i.dueDate), today),
  ).length;

  const byStatus = (['open', 'on_pause', 'closed'] as const).map((status) => ({
    status,
    count: filtered.filter((i) => i.status === status).length,
  }));

  const byPriority = (['high', 'medium', 'low'] as const).map((priority) => ({
    priority,
    count: filtered.filter((i) => i.priority === priority).length,
  }));

  // Build a daily created/closed series, then accumulate a running backlog.
  const trendMap = new Map<string, { created: number; closed: number }>();
  inPeriod.forEach((i) => {
    const key = format(parseISO(i.createdAt), 'yyyy-MM-dd');
    const entry = trendMap.get(key) ?? { created: 0, closed: 0 };
    entry.created += 1;
    if (i.status === 'closed') entry.closed += 1;
    trendMap.set(key, entry);
  });
  let backlog = 0;
  const trend = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { created, closed }]) => {
      backlog += created - closed;
      return { date, created, closed, backlog };
    });

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  // Forward-looking risk signals (overdue, stale, high-priority, due soon).
  const risk = {
    overdueToday: filtered.filter(
      (i) => i.status === 'open' && i.dueDate && isBefore(parseISO(i.dueDate), today),
    ).length,
    staleSince7d: filtered.filter(
      (i) => i.status === 'open' && isBefore(parseISO(i.updatedAt), sevenDaysAgo),
    ).length,
    highPriorityOpen: filtered.filter((i) => i.status === 'open' && i.priority === 'high').length,
    dueWithin7d: filtered.filter(
      (i) =>
        i.status === 'open' &&
        i.dueDate &&
        !isBefore(parseISO(i.dueDate), today) &&
        isBefore(parseISO(i.dueDate), sevenDaysFromNow),
    ).length,
  };

  // Group counts by incident type, sorted most-frequent first.
  const typeMap = new Map<string, { typeName: string; count: number }>();
  filtered.forEach((i) => {
    if (!i.type?.key) return;
    const prev = typeMap.get(i.type.key) ?? { typeName: i.type.name, count: 0 };
    prev.count += 1;
    typeMap.set(i.type.key, prev);
  });
  const byType = Array.from(typeMap.entries())
    .map(([typeKey, { typeName, count }]) => ({ typeKey, typeName, count }))
    .sort((a, b) => b.count - a.count);

  const tagMap = new Map<string, { tagName: string; tagColor: string; count: number }>();
  filtered.forEach((i) =>
    (i.tags ?? []).filter(Boolean).forEach((t) => {
      const prev = tagMap.get(t.id) ?? { tagName: t.name, tagColor: t.color, count: 0 };
      prev.count += 1;
      tagMap.set(t.id, prev);
    }),
  );
  const byTag = Array.from(tagMap.entries())
    .map(([tagId, { tagName, tagColor, count }]) => ({ tagId, tagName, tagColor, count }))
    .sort((a, b) => b.count - a.count);

  // Team leaderboards: who closes (resolvers), who reports (reporters) and
  // who currently carries open/overdue work (workload).
  const resolverMap = new Map<
    string,
    { closedCount: number; totalDays: number; user: Incident['owner'] }
  >();
  filtered
    .filter((i) => i.status === 'closed')
    .forEach((i) => {
      (i.assignees ?? []).filter(Boolean).forEach((a) => {
        const prev = resolverMap.get(a.id) ?? { closedCount: 0, totalDays: 0, user: a };
        prev.closedCount += 1;
        prev.totalDays += i.closingDate
          ? Math.max(0, differenceInDays(parseISO(i.closingDate), parseISO(i.createdAt)))
          : 0;
        resolverMap.set(a.id, prev);
      });
    });

  const reporterMap = new Map<string, { createdCount: number; user: Incident['owner'] }>();
  filtered.forEach((i) => {
    if (!i.owner?.id) return;
    const prev = reporterMap.get(i.owner.id) ?? { createdCount: 0, user: i.owner };
    prev.createdCount += 1;
    reporterMap.set(i.owner.id, prev);
  });

  const workloadMap = new Map<
    string,
    { openCount: number; overdueCount: number; user: Incident['owner'] }
  >();
  filtered
    .filter((i) => i.status === 'open')
    .forEach((i) => {
      const overdue = i.dueDate ? isBefore(parseISO(i.dueDate), today) : false;
      (i.assignees ?? []).filter(Boolean).forEach((a) => {
        const prev = workloadMap.get(a.id) ?? { openCount: 0, overdueCount: 0, user: a };
        prev.openCount += 1;
        if (overdue) prev.overdueCount += 1;
        workloadMap.set(a.id, prev);
      });
    });

  // Geo points (one per located incident) for the map heatmap layer.
  const heatmapPoints = filtered
    .filter((i) => i.coordinates !== null)
    .map((i) => ({ lat: i.coordinates!.lat, lng: i.coordinates!.lng, weight: 1 }));

  // Daily creation tally for the calendar activity grid.
  const calMap = new Map<string, number>();
  filtered.forEach((i) => {
    const key = format(parseISO(i.createdAt), 'yyyy-MM-dd');
    calMap.set(key, (calMap.get(key) ?? 0) + 1);
  });
  const calendarActivity = Array.from(calMap.entries()).map(([date, count]) => ({ date, count }));

  return {
    openCount,
    createdInPeriod,
    closedInPeriod,
    closureRate,
    avgResolutionDays,
    overdueActiveCount,
    byStatus,
    byPriority,
    trend,
    risk,
    byType,
    byTag,
    team: {
      resolvers: Array.from(resolverMap.values())
        .map(({ closedCount, totalDays, user }) => ({
          user,
          closedCount,
          avgDays: closedCount > 0 ? Math.round(totalDays / closedCount) : 0,
        }))
        .sort((a, b) => b.closedCount - a.closedCount),
      reporters: Array.from(reporterMap.values())
        .map(({ createdCount, user }) => ({ user, createdCount }))
        .sort((a, b) => b.createdCount - a.createdCount),
      workload: Array.from(workloadMap.values())
        .map(({ openCount, overdueCount, user }) => ({ user, openCount, overdueCount }))
        .sort((a, b) => b.openCount - a.openCount),
    },
    heatmapPoints,
    calendarActivity,
  };
}
