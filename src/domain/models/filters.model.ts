import type { IncidentStatus, IncidentPriority } from './incident.model';

/** Time window presets for the dashboard; `custom` enables `customRange`. */
export type DashboardPeriod = '7d' | '15d' | '30d' | '90d' | '6m' | 'custom';

/**
 * Active dashboard filter set held in the filters store and passed to the
 * metrics selector. Optional arrays are AND-combined; an empty/undefined
 * array means "no constraint" for that dimension.
 */
export interface DashboardFilters {
  period: DashboardPeriod;
  customRange?: { from: string; to: string };
  status?: IncidentStatus[];
  priority?: IncidentPriority[];
  typeKey?: string[];
  createdByUser?: string[];
  responsibleUser?: string[];
  createdByCompany?: string[];
  responsibleByCompany?: string[];
}

/** Filter set for the map view (independent from the dashboard filters). */
export interface MapFilters {
  date: string;
  lastVisits: number;
}
