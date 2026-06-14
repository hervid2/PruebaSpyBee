import type { IncidentStatus, IncidentPriority, UserRef } from './incident.model';

export interface DashboardMetrics {
  openCount: number;
  createdInPeriod: number;
  closedInPeriod: number;
  closureRate: number;
  avgResolutionDays: number | null;
  overdueActiveCount: number;
  byStatus: { status: IncidentStatus; count: number }[];
  byPriority: { priority: IncidentPriority; count: number }[];
  trend: { date: string; created: number; closed: number; backlog: number }[];
  risk: {
    overdueToday: number;
    staleSince7d: number;
    highPriorityOpen: number;
    dueWithin7d: number;
  };
  byCategory: { category: string; count: number }[];
  byTag: { tag: string; count: number; children?: { tag: string; count: number }[] }[];
  team: {
    resolvers: { user: UserRef; closedCount: number; avgDays: number }[];
    reporters: { user: UserRef; createdCount: number }[];
    workload: { user: UserRef; openCount: number; overdueCount: number }[];
  };
  heatmapPoints: { lat: number; lng: number; weight: number }[];
  calendarActivity: { date: string; count: number }[];
}
