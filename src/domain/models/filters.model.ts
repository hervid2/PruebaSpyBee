import type { IncidentStatus, IncidentPriority } from './incident.model';

export type DashboardPeriod = '7d' | '30d' | '90d' | 'custom';

export interface DashboardFilters {
  period: DashboardPeriod;
  customRange?: { from: string; to: string };
  status?: IncidentStatus[];
  priority?: IncidentPriority[];
  typeKey?: string[];
  createdByUser?: string[];
  responsibleUser?: string[];
}

export interface MapFilters {
  date: string;
  lastVisits: number;
}
