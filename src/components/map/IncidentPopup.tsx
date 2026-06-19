/**
 * Builds the HTML string for a marker's Mapbox popup. Mapbox popups accept raw
 * HTML, so this returns a template string instead of JSX; the incident-detail
 * link is wired up by the parent via the `data-id` attribute.
 */
import type { Incident } from '@/domain/models';

const STATUS_LABELS: Record<Incident['status'], string> = {
  open: 'Abierta',
  on_pause: 'Pausada',
  closed: 'Cerrada',
};

const PRIORITY_LABELS: Record<Incident['priority'], string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const PRIORITY_COLORS: Record<Incident['priority'], string> = {
  high: '#e5484d',
  medium: '#f5a623',
  low: '#34c759',
};

/** Escapes user-supplied text — popups are raw HTML, so prevent injection. */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Returns the popup markup for an incident (code, title, badges, assignees). */
export function getPopupHTML(incident: Incident): string {
  const priorityColor = PRIORITY_COLORS[incident.priority];
  const visibleAssignees = incident.assignees.slice(0, 2);
  const extraCount = Math.max(0, incident.assignees.length - 2);
  const assigneeText =
    visibleAssignees.length > 0
      ? visibleAssignees.map((a) => esc(a.name)).join(', ') +
        (extraCount > 0 ? ` +${extraCount}` : '')
      : '';

  return `
    <div class="incident-popup">
      <p class="incident-popup__code">#${esc(incident.sequenceId)}</p>
      <h3 class="incident-popup__title">${esc(incident.title)}</h3>
      <div class="incident-popup__badges">
        <span class="incident-popup__badge" style="background:${priorityColor}22;color:${priorityColor}">
          ${PRIORITY_LABELS[incident.priority]}
        </span>
        <span class="incident-popup__badge incident-popup__badge--status">
          ${STATUS_LABELS[incident.status]}
        </span>
      </div>
      ${assigneeText ? `<p class="incident-popup__assignees">${assigneeText}</p>` : ''}
      <a class="incident-popup__link" href="#" data-id="${esc(incident.id)}">
        Ver detalles →
      </a>
    </div>
  `;
}
