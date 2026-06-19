/**
 * Unit tests for the issues store factory. Asserts seeding, the prepend
 * (LIFO) ordering of addIncident, and that existing incidents are never
 * mutated — testing the vanilla factory directly, no React Provider needed.
 */
import { describe, it, expect } from 'vitest';
import { createIssuesStore } from '@/store/useIssuesStore';
import type { Incident } from '@/domain/models';

const baseIncident: Incident = {
  id: 'inc-001',
  sequenceId: '001',
  order: 1,
  title: 'Fisura en columna',
  description: 'Fisura longitudinal visible en columna C4',
  type: { id: 't1', key: 'structural', name: 'Estructural', name_en: 'Structural' },
  priority: 'high',
  status: 'open',
  approval: false,
  project: { id: 'proj-1', name: 'Proyecto Onboarding' },
  owner: { id: 'u1', name: 'Julian Lozano', email: 'julian@spybee.com' },
  assignees: [],
  observers: [],
  coordinates: { lat: 4.710989, lng: -74.072092 },
  locationDescription: 'Piso 2, Eje C',
  dueDate: '2026-06-30',
  closingDate: null,
  media: [],
  tags: [],
  createdAt: '2026-06-01T08:00:00Z',
  updatedAt: '2026-06-01T08:00:00Z',
};

describe('createIssuesStore (vanilla factory)', () => {
  it('inicializa con incidencias provistas', () => {
    const store = createIssuesStore([baseIncident]);
    expect(store.getState().incidents).toHaveLength(1);
    expect(store.getState().incidents[0].id).toBe('inc-001');
  });

  it('inicializa con array vacío por defecto', () => {
    const store = createIssuesStore();
    expect(store.getState().incidents).toHaveLength(0);
  });

  it('addIncident agrega al inicio de la lista', () => {
    const store = createIssuesStore([baseIncident]);
    const newIncident: Incident = {
      ...baseIncident,
      id: 'inc-002',
      title: 'Humedad en techo',
      sequenceId: '002',
    };
    store.getState().addIncident(newIncident);
    const incidents = store.getState().incidents;
    expect(incidents).toHaveLength(2);
    expect(incidents[0].id).toBe('inc-002');
  });

  it('addIncident no muta la incidencia original', () => {
    const store = createIssuesStore([baseIncident]);
    const newIncident: Incident = { ...baseIncident, id: 'inc-003', title: 'Nuevo' };
    store.getState().addIncident(newIncident);
    // La incidencia original sigue en índice 1
    expect(store.getState().incidents[1].id).toBe('inc-001');
  });

  it('múltiples addIncident mantienen el orden LIFO', () => {
    const store = createIssuesStore();
    const a: Incident = { ...baseIncident, id: 'a', title: 'A' };
    const b: Incident = { ...baseIncident, id: 'b', title: 'B' };
    const c: Incident = { ...baseIncident, id: 'c', title: 'C' };
    store.getState().addIncident(a);
    store.getState().addIncident(b);
    store.getState().addIncident(c);
    const ids = store.getState().incidents.map((i) => i.id);
    expect(ids).toEqual(['c', 'b', 'a']);
  });
});
