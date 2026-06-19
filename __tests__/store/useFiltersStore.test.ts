/**
 * Unit tests for the filters store. Verifies each action updates only its slice
 * (map date, last-visits, 3D toggle, dashboard filter merge/reset) without
 * mutating unrelated state; the store is reset before each case.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useFiltersStore } from '@/store/useFiltersStore';

describe('useFiltersStore', () => {
  beforeEach(() => {
    useFiltersStore.setState({
      mapFilters: { date: '2026-06-14', lastVisits: 5 },
      dashboardFilters: { period: '30d' },
      is3D: false,
    });
  });

  it('setMapDate actualiza solo la fecha', () => {
    useFiltersStore.getState().setMapDate('2026-06-01');
    const { mapFilters } = useFiltersStore.getState();
    expect(mapFilters.date).toBe('2026-06-01');
    expect(mapFilters.lastVisits).toBe(5); // no mutado
  });

  it('setLastVisits actualiza el contador de visitas', () => {
    useFiltersStore.getState().setLastVisits(3);
    expect(useFiltersStore.getState().mapFilters.lastVisits).toBe(3);
  });

  it('setLastVisits no muta el campo date', () => {
    useFiltersStore.getState().setLastVisits(2);
    expect(useFiltersStore.getState().mapFilters.date).toBe('2026-06-14');
  });

  it('toggle3D alterna el flag entre false y true', () => {
    expect(useFiltersStore.getState().is3D).toBe(false);
    useFiltersStore.getState().toggle3D();
    expect(useFiltersStore.getState().is3D).toBe(true);
    useFiltersStore.getState().toggle3D();
    expect(useFiltersStore.getState().is3D).toBe(false);
  });

  it('setDashboardFilters fusiona actualizaciones parciales', () => {
    useFiltersStore.getState().setDashboardFilters({ period: '7d' });
    expect(useFiltersStore.getState().dashboardFilters.period).toBe('7d');
  });

  it('resetDashboardFilters restaura el período por defecto', () => {
    useFiltersStore.getState().setDashboardFilters({ period: '90d' });
    useFiltersStore.getState().resetDashboardFilters();
    expect(useFiltersStore.getState().dashboardFilters.period).toBe('30d');
  });
});
