import { differenceInDays, isAfter, isBefore, parseISO, format, startOfDay } from 'date-fns';
import type { Incident } from '../models/incident.model';
import type { DashboardFilters } from '../models/filters.model';
import type { DashboardMetrics } from '../models/dashboard-metrics.model';

function getPeriodRange(filters: DashboardFilters): { from: Date; to: Date } {
  const to = startOfDay(new Date());
  if (filters.period === 'custom' && filters.customRange) {
    return { from: parseISO(filters.customRange.from), to: parseISO(filters.customRange.to) };
  }
  const days = filters.period === '7d' ? 7 : filters.period === '30d' ? 30 : 90;
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from, to };
}

export function getDashboardMetrics(
  incidents: Incident[],
  filters: DashboardFilters,
): DashboardMetrics {
  const now = new Date();
  const today = startOfDay(now);
  const { from, to } = getPeriodRange(filters);

  let filtered = incidents;
  if (filters.createdByCompany?.length) {
    filtered = filtered.filter((i) => filters.createdByCompany!.includes(i.createdBy.company));
  }
  if (filters.createdByUser?.length) {
    filtered = filtered.filter((i) => filters.createdByUser!.includes(i.createdBy.id));
  }
  if (filters.responsibleUser?.length) {
    filtered = filtered.filter((i) =>
      i.assignees.some((a) => filters.responsibleUser!.includes(a.id)),
    );
  }
  if (filters.responsibleCompany?.length) {
    filtered = filtered.filter((i) =>
      i.assignees.some((a) => filters.responsibleCompany!.includes(a.company)),
    );
  }

  const inPeriod = filtered.filter((i) => {
    const created = parseISO(i.createdAt);
    return !isBefore(created, from) && !isAfter(created, to);
  });

  const openCount = filtered.filter((i) => i.status === 'abierta').length;
  const createdInPeriod = inPeriod.length;
  const closedInPeriod = inPeriod.filter((i) => i.status === 'cerrada').length;
  const closureRate =
    createdInPeriod > 0 ? Math.round((closedInPeriod / createdInPeriod) * 100) : 0;

  const closedWithDuration = filtered.filter((i) => i.status === 'cerrada');
  const avgResolutionDays =
    closedWithDuration.length > 0
      ? Math.round(
          closedWithDuration.reduce((acc, i) => {
            const diff = differenceInDays(parseISO(i.updatedAt), parseISO(i.createdAt));
            return acc + Math.max(0, diff);
          }, 0) / closedWithDuration.length,
        )
      : null;

  const overdueActiveCount = filtered.filter(
    (i) => i.status === 'abierta' && i.dueDate && isBefore(parseISO(i.dueDate), today),
  ).length;

  const byStatus = (['abierta', 'pausada', 'cerrada'] as const).map((status) => ({
    status,
    count: filtered.filter((i) => i.status === status).length,
  }));

  const byPriority = (['alta', 'media', 'baja'] as const).map((priority) => ({
    priority,
    count: filtered.filter((i) => i.priority === priority).length,
  }));

  const trendMap = new Map<string, { created: number; closed: number }>();
  inPeriod.forEach((i) => {
    const key = format(parseISO(i.createdAt), 'yyyy-MM-dd');
    const entry = trendMap.get(key) ?? { created: 0, closed: 0 };
    entry.created += 1;
    if (i.status === 'cerrada') entry.closed += 1;
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

  const risk = {
    overdueToday: filtered.filter(
      (i) => i.status === 'abierta' && i.dueDate && isBefore(parseISO(i.dueDate), today),
    ).length,
    staleSince7d: filtered.filter(
      (i) => i.status === 'abierta' && isBefore(parseISO(i.updatedAt), sevenDaysAgo),
    ).length,
    highPriorityOpen: filtered.filter((i) => i.status === 'abierta' && i.priority === 'alta')
      .length,
    dueWithin7d: filtered.filter(
      (i) =>
        i.status === 'abierta' &&
        i.dueDate &&
        !isBefore(parseISO(i.dueDate), today) &&
        isBefore(parseISO(i.dueDate), sevenDaysFromNow),
    ).length,
  };

  const categoryMap = new Map<string, number>();
  filtered.forEach((i) => {
    const key = i.category.name;
    categoryMap.set(key, (categoryMap.get(key) ?? 0) + 1);
  });
  const byCategory = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const tagMap = new Map<string, number>();
  filtered.forEach((i) => i.tags.forEach((t) => tagMap.set(t.name, (tagMap.get(t.name) ?? 0) + 1)));
  const byTag = Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  const resolverMap = new Map<
    string,
    { closedCount: number; totalDays: number; user: (typeof filtered)[0]['createdBy'] }
  >();
  filtered
    .filter((i) => i.status === 'cerrada')
    .forEach((i) => {
      i.assignees.forEach((a) => {
        const prev = resolverMap.get(a.id) ?? { closedCount: 0, totalDays: 0, user: a };
        prev.closedCount += 1;
        prev.totalDays += Math.max(
          0,
          differenceInDays(parseISO(i.updatedAt), parseISO(i.createdAt)),
        );
        resolverMap.set(a.id, prev);
      });
    });

  const reporterMap = new Map<
    string,
    { createdCount: number; user: (typeof filtered)[0]['createdBy'] }
  >();
  filtered.forEach((i) => {
    const prev = reporterMap.get(i.createdBy.id) ?? { createdCount: 0, user: i.createdBy };
    prev.createdCount += 1;
    reporterMap.set(i.createdBy.id, prev);
  });

  const workloadMap = new Map<
    string,
    { openCount: number; overdueCount: number; user: (typeof filtered)[0]['createdBy'] }
  >();
  filtered
    .filter((i) => i.status === 'abierta')
    .forEach((i) => {
      const overdue = i.dueDate ? isBefore(parseISO(i.dueDate), today) : false;
      i.assignees.forEach((a) => {
        const prev = workloadMap.get(a.id) ?? { openCount: 0, overdueCount: 0, user: a };
        prev.openCount += 1;
        if (overdue) prev.overdueCount += 1;
        workloadMap.set(a.id, prev);
      });
    });

  const heatmapPoints = filtered
    .filter((i) => i.location !== null)
    .map((i) => ({ lat: i.location!.lat, lng: i.location!.lng, weight: 1 }));

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
    byCategory,
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
