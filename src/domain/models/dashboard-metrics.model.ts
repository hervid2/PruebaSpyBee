import type { IncidentStatus, IncidentPriority, UserRef } from './incident.model';

/**
 * Pre-aggregated, chart-ready view model produced by the dashboard selector
 * from a raw `Incident[]`. Each field maps to a specific dashboard widget,
 * keeping React components free of any aggregation logic.
 */
export interface DashboardMetrics {
  openCount: number;
  createdInPeriod: number;
  closedInPeriod: number;
  /** Percentage of period incidents that are closed (0–100). */
  closureRate: number;
  /** Mean days from creation to closing; null when nothing is closed yet. */
  avgResolutionDays: number | null;
  overdueActiveCount: number;
  /** Counts per status — feeds the status donut/bar charts. */
  byStatus: { status: IncidentStatus; count: number }[];
  /** Counts per priority — feeds the priority distribution chart. */
  byPriority: { priority: IncidentPriority; count: number }[];
  /** Daily created/closed series with running backlog — feeds the trend area chart. */
  trend: { date: string; created: number; closed: number; backlog: number }[];
  /** Forward-looking risk signals shown as alert indicators. */
  risk: {
    overdueToday: number;
    staleSince7d: number;
    highPriorityOpen: number;
    dueWithin7d: number;
  };
  byType: { typeKey: string; typeName: string; count: number }[];
  byTag: { tagId: string; tagName: string; tagColor: string; count: number }[];
  /** Per-user leaderboards powering the team performance section. */
  team: {
    resolvers: { user: UserRef; closedCount: number; avgDays: number }[];
    reporters: { user: UserRef; createdCount: number }[];
    workload: { user: UserRef; openCount: number; overdueCount: number }[];
  };
  /** Weighted geo points for the map heatmap layer. */
  heatmapPoints: { lat: number; lng: number; weight: number }[];
  /** Daily creation counts feeding the calendar activity grid. */
  calendarActivity: { date: string; count: number }[];
}
