/**
 * "Export and connect" (roadmap 8.10, requirements.md §1.10): manages the
 * caller's long-lived data token (`/reports/data-token`) and builds the
 * stable `/reports/dashboard-data` URL meant to be pasted into Power BI's
 * Web connector or Looker Studio — distinct from the short-lived session
 * token every other authenticated call in this app uses. Mirrors
 * settings.service.ts's clientFetch pattern for the token-management calls;
 * the CSV download below talks to the backend directly since it needs the
 * raw response body, not JSON.
 */
import { apiFetch } from '@/lib/api-client';
import { useAuthStore, refreshAccessToken } from '@/store/useAuthStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface DataTokenStatus {
  hasToken: boolean;
  createdAt: string | null;
}

export interface DataTokenCreated {
  token: string;
  createdAt: string;
  dashboardDataUrl: string;
}

function clientFetch<T>(path: string, options: Parameters<typeof apiFetch>[1] = {}): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken;
  return apiFetch<T>(path, { ...options, accessToken }, refreshAccessToken);
}

/** `GET /reports/data-token` — never returns the raw value, only whether one exists. */
export function getDataTokenStatus(): Promise<DataTokenStatus> {
  return clientFetch<DataTokenStatus>('/reports/data-token');
}

/** `POST /reports/data-token` — the raw token is only ever present on this response. */
export async function generateDataToken(): Promise<DataTokenCreated> {
  const res = await clientFetch<{ token: string; createdAt: string }>('/reports/data-token', {
    method: 'POST',
  });
  return {
    ...res,
    // Still `?token=`, deliberately: the whole point of this feature is a URL
    // that can be pasted into Power BI's Web connector or Looker Studio, and
    // several of those paths accept nothing but a URL. A caller that *can*
    // send a header should use `X-Data-Token` instead (F9.5) — the API accepts
    // either and prefers the header.
    dashboardDataUrl: `${API_BASE_URL}/reports/dashboard-data?token=${res.token}`,
  };
}

/** `DELETE /reports/data-token`. */
export function revokeDataToken(): Promise<void> {
  return clientFetch<void>('/reports/data-token', { method: 'DELETE' });
}

/**
 * `GET /incidents/export.csv` — Bearer-authenticated, so it can't be a plain
 * `<a href>` download link; fetches the CSV as a blob with the in-memory
 * access token and triggers the save client-side.
 */
export async function fetchIncidentsCsv(params: {
  status?: string[];
  priority?: string[];
  typeKey?: string[];
}): Promise<Blob> {
  const accessToken = useAuthStore.getState().accessToken;
  const qs = new URLSearchParams();
  params.status?.forEach((v) => qs.append('status', v));
  params.priority?.forEach((v) => qs.append('priority', v));
  params.typeKey?.forEach((v) => qs.append('typeKey', v));

  const res = await fetch(`${API_BASE_URL}/incidents/export.csv?${qs.toString()}`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.blob();
}
