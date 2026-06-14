export type IncidentStatus = 'abierta' | 'pausada' | 'cerrada';
export type IncidentPriority = 'alta' | 'media' | 'baja';

export interface GeoLocation {
  lat: number;
  lng: number;
  details?: string;
}

export interface Attachment {
  id: string;
  type: 'image' | 'video' | 'document';
  url: string;
  name: string;
  uploadedAt: string;
}

export interface UserRef {
  id: string;
  name: string;
  company: string;
  role?: string;
  avatarUrl?: string;
}

export interface Tag {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Category {
  id: string;
  name: string;
  color?: string;
}

export interface Incident {
  id: string;
  code: string;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  category: Category;
  tags: Tag[];
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UserRef;
  assignees: UserRef[];
  watchers: UserRef[];
  location: GeoLocation | null;
  attachments: Attachment[];
}
