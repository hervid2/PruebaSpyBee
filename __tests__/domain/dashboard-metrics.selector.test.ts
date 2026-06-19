import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { getDashboardMetrics } from '@/domain/selectors/dashboard-metrics.selector';
import { FIXTURE_INCIDENTS } from '../fixtures/incidents.fixture';
import type { DashboardFilters } from '@/domain/models/filters.model';

// Tests are pinned to 2026-06-14 so the 30d window (2026-05-15 → 2026-06-14) is deterministic.
// f1 createdAt 2026-05-10 → NOT in 30d period
// f2 createdAt 2026-05-12 → NOT in 30d period
// f3 createdAt 2026-05-15 → boundary: in period
// f4 createdAt 2026-05-20 → in period
// f5 createdAt 2026-05-05 → NOT in period

// Noon UTC on 2026-06-14 ensures startOfDay() returns June 14 local midnight
// in any timezone from UTC-12 to UTC+11 — avoiding off-by-one-day edge cases.
const FIXED_TODAY = new Date('2026-06-14T12:00:00.000Z');
const DEFAULT_FILTERS: DashboardFilters = { period: '30d' };

describe('getDashboardMetrics', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TODAY);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe('KPI básicos', () => {
    it('calcula openCount correctamente (incidencias open en filtered)', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // open: f1, f2, f5 → 3
      expect(metrics.openCount).toBe(3);
    });

    it('calcula closedInPeriod dentro del rango de 30 días', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // inPeriod (30d from 2026-06-14): f3 (2026-05-15), f4 (2026-05-20)
      // f3 es closed → closedInPeriod = 1
      expect(metrics.closedInPeriod).toBe(1);
    });

    it('calcula createdInPeriod dentro del rango', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // f3 (2026-05-15) + f4 (2026-05-20) → 2
      expect(metrics.createdInPeriod).toBe(2);
    });

    it('calcula closureRate como porcentaje redondeado', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // closedInPeriod=1, createdInPeriod=2 → 50%
      expect(metrics.closureRate).toBe(50);
    });

    it('closureRate es 0 cuando no hay creadas en el periodo', () => {
      // Use custom range with no incidents
      const filters: DashboardFilters = {
        period: 'custom',
        customRange: { from: '2020-01-01', to: '2020-01-31' },
      };
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, filters);
      expect(metrics.closureRate).toBe(0);
      expect(metrics.createdInPeriod).toBe(0);
    });

    it('calcula avgResolutionDays para incidencias cerradas', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // f3: closingDate 2026-05-25, createdAt 2026-05-15 → 10 días
      // Only f3 has closingDate
      expect(metrics.avgResolutionDays).toBe(10);
    });

    it('avgResolutionDays es null cuando no hay incidencias cerradas con fecha', () => {
      const openOnly = FIXTURE_INCIDENTS.filter((i) => i.status !== 'closed');
      const metrics = getDashboardMetrics(openOnly, DEFAULT_FILTERS);
      expect(metrics.avgResolutionDays).toBeNull();
    });

    it('calcula overdueActiveCount (open + dueDate pasada)', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // f1: open, dueDate 2026-04-01 → overdue ✓
      // f2: open, dueDate 2026-06-20 → not overdue
      // f5: open, dueDate null → not counted
      expect(metrics.overdueActiveCount).toBe(1);
    });
  });

  describe('byStatus', () => {
    it('devuelve conteos por los tres estados posibles', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      const openEntry = metrics.byStatus.find((s) => s.status === 'open');
      const closedEntry = metrics.byStatus.find((s) => s.status === 'closed');
      const pausedEntry = metrics.byStatus.find((s) => s.status === 'on_pause');
      expect(openEntry?.count).toBe(3);
      expect(closedEntry?.count).toBe(1);
      expect(pausedEntry?.count).toBe(1);
    });

    it('siempre incluye las tres claves aunque el conteo sea 0', () => {
      const onlyOpen = FIXTURE_INCIDENTS.filter((i) => i.status === 'open');
      const metrics = getDashboardMetrics(onlyOpen, DEFAULT_FILTERS);
      expect(metrics.byStatus).toHaveLength(3);
      expect(metrics.byStatus.find((s) => s.status === 'closed')?.count).toBe(0);
    });
  });

  describe('byPriority', () => {
    it('devuelve conteos correctos por prioridad', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      expect(metrics.byPriority.find((p) => p.priority === 'high')?.count).toBe(1);
      expect(metrics.byPriority.find((p) => p.priority === 'medium')?.count).toBe(2);
      expect(metrics.byPriority.find((p) => p.priority === 'low')?.count).toBe(2);
    });
  });

  describe('byType', () => {
    it('agrupa por tipo de incidencia y ordena por count desc', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // structural: f1, f3, f5 → 3; plumbing: f2, f4 → 2
      expect(metrics.byType[0].typeKey).toBe('structural');
      expect(metrics.byType[0].count).toBe(3);
      expect(metrics.byType[1].typeKey).toBe('plumbing');
      expect(metrics.byType[1].count).toBe(2);
    });
  });

  describe('byTag', () => {
    it('cuenta tags a través de todas las incidencias filtradas', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // f1 y f5 tienen tag1 "Bloque A"
      const tag = metrics.byTag.find((t) => t.tagId === 'tag1');
      expect(tag?.count).toBe(2);
      expect(tag?.tagName).toBe('Bloque A');
    });
  });

  describe('risk indicators', () => {
    it('calcula overdueToday correctamente', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // f1: open, dueDate 2026-04-01 → overdue
      expect(metrics.risk.overdueToday).toBe(1);
    });

    it('calcula staleSince7d (open, updatedAt > 7d atrás)', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // f2: updated 2026-06-01 (>7d from 2026-06-14) → stale
      // f5: updated 2026-05-01 → stale
      // f1: updated 2026-06-07 (7d ago exactly, boundary)
      // boundary: sevenDaysAgo = 2026-06-07; isBefore(2026-06-07, 2026-06-07) = false
      expect(metrics.risk.staleSince7d).toBeGreaterThanOrEqual(2);
    });

    it('calcula highPriorityOpen correctamente', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // f1: open, high → 1
      expect(metrics.risk.highPriorityOpen).toBe(1);
    });

    it('calcula dueWithin7d (open, dueDate entre hoy y 7 días después)', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // f2: open, dueDate 2026-06-20 (within 7d from 2026-06-14) → ✓
      // f4: on_pause → no cuenta (solo open)
      expect(metrics.risk.dueWithin7d).toBe(1);
    });
  });

  describe('trend', () => {
    it('devuelve entradas de tendencia ordenadas cronológicamente', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // inPeriod: f3 (2026-05-15) y f4 (2026-05-20) → 2 fechas distintas
      expect(metrics.trend.length).toBeGreaterThanOrEqual(1);
      if (metrics.trend.length > 1) {
        expect(metrics.trend[0].date < metrics.trend[1].date).toBe(true);
      }
    });

    it('trend contiene campos date, created, closed, backlog', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      if (metrics.trend.length > 0) {
        const entry = metrics.trend[0];
        expect(entry).toHaveProperty('date');
        expect(entry).toHaveProperty('created');
        expect(entry).toHaveProperty('closed');
        expect(entry).toHaveProperty('backlog');
      }
    });
  });

  describe('team metrics', () => {
    it('reporters lista quién creó más incidencias', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      expect(metrics.team.reporters.length).toBeGreaterThan(0);
      // All incidents share the same owner → 1 reporter
      const topReporter = metrics.team.reporters[0];
      expect(topReporter.user.id).toBe('user_1');
      expect(topReporter.createdCount).toBe(FIXTURE_INCIDENTS.length);
    });

    it('resolvers lista quién cerró más incidencias', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // f3 closed with assignee user_2
      const resolver = metrics.team.resolvers.find((r) => r.user.id === 'user_2');
      expect(resolver?.closedCount).toBeGreaterThanOrEqual(1);
    });

    it('workload lista carga de incidencias abiertas por asignado', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // f1 (open, assignee user_2) + f5 (open, assignee user_2) → user_2 has 2 open
      const workload = metrics.team.workload.find((w) => w.user.id === 'user_2');
      expect(workload?.openCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('filtros de dashboard', () => {
    it('filtra por status', () => {
      const filters: DashboardFilters = { period: '90d', status: ['open'] };
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, filters);
      expect(metrics.byStatus.find((s) => s.status === 'closed')?.count).toBe(0);
      expect(metrics.byStatus.find((s) => s.status === 'open')?.count).toBeGreaterThan(0);
    });

    it('filtra por priority', () => {
      const filters: DashboardFilters = { period: '90d', priority: ['high'] };
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, filters);
      expect(metrics.byPriority.find((p) => p.priority === 'high')?.count).toBe(1);
      expect(metrics.byPriority.find((p) => p.priority === 'low')?.count).toBe(0);
    });

    it('filtra por typeKey', () => {
      const filters: DashboardFilters = { period: '90d', typeKey: ['plumbing'] };
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, filters);
      expect(metrics.byType.every((t) => t.typeKey === 'plumbing')).toBe(true);
      expect(metrics.byType[0].count).toBe(2);
    });

    it('filtra por createdByUser (owner.id)', () => {
      const filters: DashboardFilters = { period: '90d', createdByUser: ['user_1'] };
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, filters);
      // All incidents have owner user_1
      expect(metrics.openCount + metrics.byStatus.find((s) => s.status === 'closed')!.count).toBe(
        FIXTURE_INCIDENTS.filter((i) => i.status !== 'on_pause').length,
      );
    });

    it('devuelve métricas vacías con rango custom sin incidencias en ese rango', () => {
      const filters: DashboardFilters = {
        period: 'custom',
        customRange: { from: '2020-01-01', to: '2020-12-31' },
      };
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, filters);
      expect(metrics.createdInPeriod).toBe(0);
      expect(metrics.trend).toHaveLength(0);
    });
  });

  describe('heatmapPoints y calendarActivity', () => {
    it('heatmapPoints incluye solo incidencias con coordenadas', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      // All fixture incidents have coordinates
      expect(metrics.heatmapPoints.length).toBe(FIXTURE_INCIDENTS.length);
      expect(metrics.heatmapPoints[0]).toHaveProperty('lat');
      expect(metrics.heatmapPoints[0]).toHaveProperty('lng');
      expect(metrics.heatmapPoints[0]).toHaveProperty('weight');
    });

    it('calendarActivity cuenta incidencias por día de creación', () => {
      const metrics = getDashboardMetrics(FIXTURE_INCIDENTS, DEFAULT_FILTERS);
      const totalFromCal = metrics.calendarActivity.reduce((acc, e) => acc + e.count, 0);
      expect(totalFromCal).toBe(FIXTURE_INCIDENTS.length);
    });
  });
});
