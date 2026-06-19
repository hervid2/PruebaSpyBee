/**
 * Core domain model for the incident-tracking app. Every feature (dashboard
 * metrics, map markers, create/detail modals) consumes these shapes, so they
 * are the single source of truth that decouples UI from the data source.
 */

// Lifecycle states; values match the real API (English).
export type IncidentStatus = 'open' | 'on_pause' | 'closed';
// Severity ranking used for sorting, risk indicators and badge colors.
export type IncidentPriority = 'high' | 'medium' | 'low';

/** Catalog entry classifying an incident (e.g. plumbing, electrical). */
export interface IncidentType {
  id: string;
  key: string;
  name: string; // Spanish display name (e.g. "Hidrosanitario")
  name_en: string; // English (e.g. "Plumbing")
}

/** Geographic point used to plot an incident on the Mapbox map. */
export interface Coordinates {
  lat: number;
  lng: number;
}

/** File attached to an incident (photo, video or document). */
export interface Media {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document';
  format: string;
  size: number;
  status: 'uploaded' | 'pending' | 'error';
  url: string;
}

/** Lightweight user reference embedded in incidents (owner, assignees…). */
export interface UserRef {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

/** Free-form label for grouping/filtering incidents. */
export interface Tag {
  id: string;
  name: string;
  color: string;
}

/** Construction project an incident belongs to. */
export interface Project {
  id: string;
  name: string;
}

/** Full incident aggregate as returned by the API and stored in state. */
export interface Incident {
  id: string;
  sequenceId: string; // e.g. "0042" — display code
  order: number;
  title: string;
  description: string;
  type: IncidentType;
  priority: IncidentPriority;
  status: IncidentStatus;
  approval: boolean;
  project: Project;
  owner: UserRef;
  assignees: UserRef[];
  observers: UserRef[];
  coordinates: Coordinates | null;
  locationDescription: string | null;
  dueDate: string | null;
  closingDate: string | null;
  media: Media[];
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Write model for the create-incident form. Differs from {@link Incident}: it
 * carries raw `File` objects (not uploaded {@link Media}) and omits
 * server-generated fields like `id`, `sequenceId` and timestamps.
 */
export interface CreateIncidentDto {
  title: string;
  description: string;
  type: IncidentType;
  priority: IncidentPriority;
  dueDate: string | null;
  assignees: UserRef[];
  observers: UserRef[];
  tags: Tag[];
  coordinates: Coordinates | null;
  locationDescription: string | null;
  media: File[];
}
