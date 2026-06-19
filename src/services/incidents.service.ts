/**
 * Data-access layer for incidents. Emulates a REST API on top of a static
 * mock dataset so the rest of the app codes against async service calls
 * exactly as it would against a real backend.
 */
import type { Incident, CreateIncidentDto, Media } from '@/domain/models/incident.model';

// The signed Supabase URL provided by the recruiter.
// Falls back to the local copy in public/mocks/ if the request fails.
const REMOTE_URL =
  'https://hkwjqhziteegahqjayvf.supabase.co/storage/v1/object/sign/vacancy-assets/' +
  'fcebe58f-a13d-496d-9155-f109ea72880e/prueba-1781273693508-incidents.mock.json?' +
  'token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83ZTQ3NjdhNC02ZWFlLTQ5OTktYjVhMi0w' +
  'YTFlNzk5MmVhNjAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2YWNhbmN5LWFzc2V0cy9mY2ViZTU4Zi1h' +
  'MTNkLTQ5NmQtOTE1NS1mMTA5ZWE3Mjg4MGUvcHJ1ZWJhLTE3ODEyNzM2OTM1MDgtaW5jaWRlbnRzLm1vY2' +
  'suanNvbiIsInNjb3BlIjoiZG93bmxvYWQiLCJpYXQiOjE3ODEyODAzNzEsImV4cCI6MTc4MjQ4OTk3MX0.' +
  'W_BhPPj7FlVg4WeZpXzTQfUIsliKl3cDPs8AD3Ewkbo';

const LOCAL_URL = '/mocks/incidents.mock.json';

/**
 * Simulates GET /incidents
 * Tries the remote Supabase URL first; falls back to the local copy.
 */
export async function getIncidents(): Promise<Incident[]> {
  let response: Response;

  try {
    response = await fetch(REMOTE_URL, { next: { revalidate: 3600 } });
    if (!response.ok) throw new Error(`Remote fetch failed: ${response.status}`);
  } catch {
    response = await fetch(LOCAL_URL);
    if (!response.ok) throw new Error('Could not load incidents from local fallback');
  }

  const raw: Incident[] = await response.json();
  return raw.filter((i) => !(i as unknown as Record<string, unknown>)['deleted']);
}

/**
 * Simulates GET /incidents/:id
 */
export async function getIncidentById(id: string): Promise<Incident | null> {
  const all = await getIncidents();
  return all.find((i) => i.id === id) ?? null;
}

/**
 * Simulates POST /incidents
 * Since there is no backend, this builds and returns a new Incident object.
 * The caller is responsible for adding it to the store (useIssuesStore.addIncident).
 */
export async function createIncident(
  dto: CreateIncidentDto,
  currentUser: Incident['owner'],
  project: Incident['project'],
): Promise<Incident> {
  const now = new Date().toISOString();

  // Turn raw File objects into Media records with local blob URLs for preview.
  const mediaItems: Media[] = dto.media.map((file, i) => ({
    id: `local_${Date.now()}_${i}`,
    name: file.name,
    type: file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : 'document',
    format: file.name.split('.').pop() ?? '',
    size: file.size,
    status: 'uploaded',
    url: URL.createObjectURL(file),
  }));

  const newIncident: Incident = {
    id: crypto.randomUUID(),
    sequenceId: String(Date.now()).slice(-6),
    order: 0,
    title: dto.title,
    description: dto.description,
    type: dto.type,
    priority: dto.priority,
    status: 'open',
    approval: false,
    project,
    owner: currentUser,
    assignees: dto.assignees,
    observers: dto.observers,
    coordinates: dto.coordinates,
    locationDescription: dto.locationDescription,
    dueDate: dto.dueDate,
    closingDate: null,
    media: mediaItems,
    tags: dto.tags,
    createdAt: now,
    updatedAt: now,
  };

  return newIncident;
}
