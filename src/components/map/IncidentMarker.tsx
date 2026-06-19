/**
 * Imperative DOM factory for a map marker. Mapbox markers take a raw HTMLElement
 * (not React), so this builds the node directly: a priority-colored ring with a
 * warning glyph, tagged with `data-incident-id` for click handling.
 */
import type { Incident } from '@/domain/models';

// Ring color encodes priority at a glance.
const PRIORITY_BORDER: Record<Incident['priority'], string> = {
  high: '#e5484d',
  medium: '#f5a623',
  low: '#34c759',
};

/** Builds the marker element for a single incident. */
export function createMarkerElement(incident: Incident): HTMLElement {
  const el = document.createElement('div');
  el.className = 'incident-marker';
  el.setAttribute('aria-label', incident.title);
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.dataset.incidentId = incident.id;

  const ring = document.createElement('div');
  ring.className = 'incident-marker__ring';
  ring.style.borderColor = PRIORITY_BORDER[incident.priority] ?? '#f2b705';

  // Warning triangle icon
  ring.innerHTML = `
    <svg width="14" height="13" viewBox="0 0 14 13" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7 0.5L13.5 12H0.5L7 0.5Z" fill="white"/>
      <rect x="6.5" y="4.5" width="1" height="4" rx="0.5" fill="#1a1a1a"/>
      <rect x="6.5" y="9.5" width="1" height="1" rx="0.5" fill="#1a1a1a"/>
    </svg>
  `;

  el.appendChild(ring);
  return el;
}
