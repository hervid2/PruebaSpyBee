export type DashboardPeriod = '7d' | '30d' | '90d' | 'custom';

export interface DashboardFilters {
  period: DashboardPeriod;
  customRange?: { from: string; to: string };
  createdByCompany?: string[];
  responsibleCompany?: string[];
  createdByUser?: string[];
  responsibleUser?: string[];
}

export interface MapFilters {
  date: string;
  lastVisits: number;
}
