/**
 * Project plans: the map toolbar's "BIM Plans" button, made functional
 * (roadmap 8.11, requirements.md §1.2 Could) — real image/PDF attachments on
 * a `Project`, not a native BIM/IFC viewer. Viewing is open to any org
 * member; attaching/deleting is admin+ (backend re-checks regardless of what
 * the UI shows). Upload mirrors media.service.ts's presign → PUT → record flow.
 */
import { apiFetch } from '@/lib/api-client';
import { useAuthStore, refreshAccessToken } from '@/store/useAuthStore';
import type { ProjectPlan } from '@/domain/models';

interface PresignResponse {
  uploadUrl: string;
  fileUrl: string;
}

function clientFetch<T>(path: string, options: Parameters<typeof apiFetch>[1] = {}): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken;
  return apiFetch<T>(path, { ...options, accessToken }, refreshAccessToken);
}

/** `GET /projects/:id/plans` — newest first. */
export function listProjectPlans(projectId: string): Promise<ProjectPlan[]> {
  return clientFetch<ProjectPlan[]>(`/projects/${projectId}/plans`);
}

/** `DELETE /plans/:id` — admin+ only (enforced server-side). */
export function deleteProjectPlan(planId: string): Promise<void> {
  return clientFetch<void>(`/plans/${planId}`, { method: 'DELETE' });
}

/** Presign → PUT directly to S3 → record the plan. Throws on any step's failure. */
export async function uploadProjectPlan(projectId: string, file: File): Promise<ProjectPlan> {
  const { uploadUrl, fileUrl } = await clientFetch<PresignResponse>(
    `/projects/${projectId}/plans/presign`,
    {
      method: 'POST',
      body: { filename: file.name, contentType: file.type, size: file.size },
    },
  );

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`Upload to storage failed (${putRes.status})`);
  }

  // See media.service.ts: the server derives type/format/size from the object
  // it can actually see in the bucket (F9.5).
  return clientFetch<ProjectPlan>(`/projects/${projectId}/plans`, {
    method: 'POST',
    body: { fileUrl, name: file.name },
  });
}
