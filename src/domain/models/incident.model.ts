// Values match the real API (English)
export type IncidentStatus = 'open' | 'on_pause' | 'closed';
export type IncidentPriority = 'high' | 'medium' | 'low';

export interface IncidentType {
  id: string;
  key: string;
  name: string; // Spanish display name (e.g. "Hidrosanitario")
  name_en: string; // English (e.g. "Plumbing")
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Media {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document';
  format: string;
  size: number;
  status: 'uploaded' | 'pending' | 'error';
  url: string;
}

export interface UserRef {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
}

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

// DTO used when creating a new incident from the form
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
