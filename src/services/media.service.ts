/**
 * Direct-to-S3 media upload, client-side only. `POST /media/presign`
 * requires an existing incident id, so this only ever runs after the
 * incident itself has been created — see IssueForm's post-create loop.
 */
import { apiFetch } from '@/lib/api-client';
import { useAuthStore, refreshAccessToken } from '@/store/useAuthStore';
import type { Media } from '@/domain/models';

interface PresignResponse {
  uploadUrl: string;
  fileUrl: string;
}

interface MediaResponse {
  id: string;
  incidentId: string;
  name: string;
  type: Media['type'];
  format: string;
  size: number;
  status: Media['status'];
  url: string;
  createdAt: string;
}

function clientFetch<T>(path: string, options: Parameters<typeof apiFetch>[1] = {}): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken;
  return apiFetch<T>(path, { ...options, accessToken }, refreshAccessToken);
}

/** Presign → PUT directly to S3 → record the attachment. Throws on any step's failure. */
export async function uploadMedia(incidentId: string, file: File): Promise<Media> {
  const { uploadUrl, fileUrl } = await clientFetch<PresignResponse>('/media/presign', {
    method: 'POST',
    body: {
      incidentId,
      filename: file.name,
      contentType: file.type,
      size: file.size,
    },
  });

  // Presigned URL carries its own auth — a plain fetch, not through the API
  // client (wrong base URL, and no Authorization header belongs on an S3 PUT).
  // `file.size` is now part of that signature (F9.5), and the browser derives
  // the `Content-Length` header from this exact body — so passing the `File`
  // straight through is what keeps the two in agreement. Wrapping or
  // re-encoding the body here would change its length and S3 would reject the
  // PUT; `Content-Length` cannot be set by hand to paper over that.
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`Upload to storage failed (${putRes.status})`);
  }

  // Only what the client legitimately owns: where it wrote, and what to call
  // it. `type`, `format` and `size` used to be sent from here and are now read
  // off the stored object by the server (F9.5) — the response still carries
  // them, and they are the verified values.
  const record = await clientFetch<MediaResponse>(`/incidents/${incidentId}/media`, {
    method: 'POST',
    body: { fileUrl, name: file.name },
  });

  return {
    id: record.id,
    name: record.name,
    type: record.type,
    format: record.format,
    size: record.size,
    status: record.status,
    url: record.url,
  };
}
