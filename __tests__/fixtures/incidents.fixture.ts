/**
 * Deterministic incident dataset shared by the unit tests. Each entry is shaped
 * to exercise a specific metric branch (overdue, stale, closed-with-date, due
 * soon…), so the selector assertions stay stable and self-documenting.
 */
import type { Incident } from '@/domain/models/incident.model';

const baseDate = '2026-05-01T10:00:00.000Z';
const owner = {
  id: 'user_1',
  name: 'Ana Gómez',
  email: 'ana@spybee.io',
  avatarUrl: undefined,
};
const assignee = {
  id: 'user_2',
  name: 'Carlos López',
  email: 'carlos@constructora.com',
  avatarUrl: undefined,
};
const typeStructural = { id: 't1', key: 'structural', name: 'Estructural', name_en: 'Structural' };
const typePlumbing = { id: 't2', key: 'plumbing', name: 'Hidrosanitario', name_en: 'Plumbing' };
const project = { id: 'proj_1', name: 'Proyecto Onboarding' };

/** Builds a valid incident from sensible defaults, overriding only what a case needs. */
function makeIncident(overrides: Partial<Incident>): Incident {
  return {
    id: crypto.randomUUID(),
    sequenceId: '0001',
    order: 1,
    title: 'Incidencia de prueba',
    description: 'Descripción de prueba',
    type: typeStructural,
    priority: 'medium',
    status: 'open',
    approval: false,
    project,
    owner,
    assignees: [assignee],
    observers: [],
    coordinates: { lat: 4.6097, lng: -74.0817 },
    locationDescription: 'Piso 2',
    dueDate: '2026-06-30',
    closingDate: null,
    media: [],
    tags: [],
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

export const FIXTURE_INCIDENTS: Incident[] = [
  // open, high priority, overdue
  makeIncident({
    id: 'f1',
    status: 'open',
    priority: 'high',
    dueDate: '2026-04-01', // overdue
    createdAt: '2026-05-10T10:00:00.000Z',
    updatedAt: '2026-06-07T10:00:00.000Z', // updated within 7d (2026-06-14 context)
    type: typeStructural,
    tags: [{ id: 'tag1', name: 'Bloque A', color: '#EF4444' }],
    assignees: [assignee],
  }),
  // open, medium priority, not overdue, stale
  makeIncident({
    id: 'f2',
    status: 'open',
    priority: 'medium',
    dueDate: '2026-06-20', // not overdue
    createdAt: '2026-05-12T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z', // stale (>7d ago from 2026-06-14)
    type: typePlumbing,
    assignees: [],
  }),
  // closed with closingDate
  makeIncident({
    id: 'f3',
    status: 'closed',
    priority: 'low',
    dueDate: '2026-05-20',
    closingDate: '2026-05-25T10:00:00.000Z',
    createdAt: '2026-05-15T10:00:00.000Z',
    updatedAt: '2026-05-25T10:00:00.000Z',
    type: typeStructural,
    assignees: [assignee],
  }),
  // on_pause, medium priority
  makeIncident({
    id: 'f4',
    status: 'on_pause',
    priority: 'medium',
    dueDate: '2026-06-18', // due within 7d from 2026-06-14
    createdAt: '2026-05-20T10:00:00.000Z',
    updatedAt: '2026-05-20T10:00:00.000Z',
    type: typePlumbing,
    assignees: [],
  }),
  // open, low priority, no due date, old update (stale)
  makeIncident({
    id: 'f5',
    status: 'open',
    priority: 'low',
    dueDate: null,
    createdAt: '2026-05-05T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z', // stale
    type: typeStructural,
    tags: [{ id: 'tag1', name: 'Bloque A', color: '#EF4444' }],
    assignees: [assignee],
  }),
];
