/**
 * Coverage for the /calendario full page view (roadmap.md F8.6): unlike the
 * compact CalendarActivity dashboard widget, every day must be selectable
 * (including empty ones) and the day-detail list must never be clipped.
 * Time is frozen so "today" (the default selected day) is deterministic.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import CalendarioView from '@/components/calendario/CalendarioView';
import { IssuesStoreProvider } from '@/store/useIssuesStore';
import { useIncidentDetailStore } from '@/store/useIncidentDetailStore';
import { MESSAGES } from '@/i18n/messages';
import type { Incident, UserRef } from '@/domain/models';

const FIXED_TODAY = new Date('2026-06-14T12:00:00.000Z');

const OWNER: UserRef = {
  id: 'owner-1',
  name: 'Ana Gómez',
  email: 'ana@example.com',
};

function makeIncident(overrides: Partial<Incident>): Incident {
  return {
    id: overrides.id ?? 'inc-1',
    sequenceId: '0001',
    order: 1,
    title: 'Incidencia de prueba',
    description: '',
    type: { id: 't1', key: 'plumbing', name: 'Hidrosanitario', name_en: 'Plumbing' },
    priority: 'medium',
    status: 'open',
    approval: 'pending',
    project: { id: 'p1', name: 'Proyecto Demo' },
    owner: OWNER,
    assignees: [],
    observers: [],
    coordinates: null,
    locationDescription: null,
    dueDate: null,
    closingDate: null,
    media: [],
    tags: [],
    deleted: false,
    createdAt: '2026-06-14T09:00:00.000Z',
    updatedAt: '2026-06-14T09:00:00.000Z',
    ...overrides,
  };
}

const busyDayIncidents = Array.from({ length: 9 }, (_, i) =>
  makeIncident({
    id: `busy-${i}`,
    sequenceId: String(i + 100).padStart(4, '0'),
    title: `Incidencia ocupada ${i}`,
    createdAt: '2026-06-10T08:00:00.000Z',
    updatedAt: '2026-06-10T08:00:00.000Z',
  }),
);

const INCIDENTS: Incident[] = [
  makeIncident({ id: 'today-1', title: 'Fuga en columna hoy' }),
  makeIncident({
    id: 'other-day',
    title: 'Grieta en muro',
    createdAt: '2026-06-05T09:00:00.000Z',
    updatedAt: '2026-06-05T09:00:00.000Z',
  }),
  ...busyDayIncidents,
];

function renderCalendario(incidents: Incident[] = INCIDENTS) {
  return render(
    <NextIntlClientProvider locale="es" messages={MESSAGES.es}>
      <IssuesStoreProvider initialIncidents={incidents}>
        <CalendarioView />
      </IssuesStoreProvider>
    </NextIntlClientProvider>,
  );
}

describe('CalendarioView — vista de calendario completo', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TODAY);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    useIncidentDetailStore.getState().closeDetail();
  });

  it('selecciona el día de hoy por defecto y muestra sus incidencias', () => {
    renderCalendario();

    expect(screen.getByText('Fuga en columna hoy')).toBeInTheDocument();
    expect(screen.queryByText('Grieta en muro')).not.toBeInTheDocument();
  });

  it('al hacer clic en un día distinto, muestra solo las incidencias de ese día', () => {
    renderCalendario();

    fireEvent.click(screen.getByRole('button', { name: /^5 de junio:/ }));

    expect(screen.getByText('Grieta en muro')).toBeInTheDocument();
    expect(screen.queryByText('Fuga en columna hoy')).not.toBeInTheDocument();
  });

  it('un día sin incidencias es seleccionable y muestra el estado vacío', () => {
    renderCalendario();

    fireEvent.click(screen.getByRole('button', { name: /^20 de junio:/ }));

    expect(screen.getByText('No hay incidencias registradas para este día.')).toBeInTheDocument();
  });

  it('no recorta la lista de un día con muchas incidencias (a diferencia del widget)', () => {
    renderCalendario();

    fireEvent.click(screen.getByRole('button', { name: /^10 de junio:/ }));

    busyDayIncidents.forEach((incident) => {
      expect(screen.getByText(incident.title)).toBeInTheDocument();
    });
    expect(screen.queryByText(/más$/)).not.toBeInTheDocument();
  });

  it('al hacer clic en una incidencia del día, abre el modal de detalle compartido', () => {
    renderCalendario();

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle de Fuga en columna hoy' }));

    expect(useIncidentDetailStore.getState().selectedIncidentId).toBe('today-1');
  });
});
