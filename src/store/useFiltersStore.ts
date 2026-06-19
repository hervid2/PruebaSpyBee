/**
 * Holds the UI filter state shared across the dashboard and map views (active
 * period, status/priority filters, map date and 3D toggle). Decoupling filters
 * from the data lets the metrics selector recompute reactively as they change.
 */
import { create } from 'zustand';
import type { MapFilters, DashboardFilters } from '@/domain/models';

interface FiltersState {
  mapFilters: MapFilters;
  dashboardFilters: DashboardFilters;
  is3D: boolean;
  setMapDate: (date: string) => void;
  setLastVisits: (visits: number) => void;
  toggle3D: () => void;
  setDashboardFilters: (filters: Partial<DashboardFilters>) => void;
  resetDashboardFilters: () => void;
}

const defaultMapFilters: MapFilters = {
  date: new Date().toISOString().split('T')[0],
  lastVisits: 5,
};

const defaultDashboardFilters: DashboardFilters = {
  period: '30d',
};

export const useFiltersStore = create<FiltersState>()((set) => ({
  mapFilters: defaultMapFilters,
  dashboardFilters: defaultDashboardFilters,
  is3D: false,
  setMapDate: (date) => set((s) => ({ mapFilters: { ...s.mapFilters, date } })),
  setLastVisits: (visits) => set((s) => ({ mapFilters: { ...s.mapFilters, lastVisits: visits } })),
  toggle3D: () => set((s) => ({ is3D: !s.is3D })),
  setDashboardFilters: (filters) =>
    set((s) => ({ dashboardFilters: { ...s.dashboardFilters, ...filters } })),
  resetDashboardFilters: () => set({ dashboardFilters: defaultDashboardFilters }),
}));
