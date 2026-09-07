import { MediaType } from '@prisma/client';

/** Server-side allowlist (requirements.md §1.7 Should: "not just the client"). */
export const ALLOWED_MEDIA_CONTENT_TYPES: Record<MediaType, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};

export const MAX_MEDIA_SIZE_BYTES: Record<MediaType, number> = {
  image: 10 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  document: 20 * 1024 * 1024,
};

/**
 * The short label `/documentos` and the gallery show for a file (F9.5).
 * Derived from the content type S3 recorded rather than from the filename the
 * client sent, so it describes the object that actually exists — the same
 * reason `type` and `size` are no longer taken from the request body. Every
 * key of `ALLOWED_MEDIA_CONTENT_TYPES` appears here; the lookup falls back to
 * the subtype for anything that somehow does not.
 */
export const MEDIA_FORMAT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
};

export function mediaTypeFromContentType(
  contentType: string,
): MediaType | null {
  const entry = (
    Object.entries(ALLOWED_MEDIA_CONTENT_TYPES) as [MediaType, string[]][]
  ).find(([, contentTypes]) => contentTypes.includes(contentType));
  return entry?.[0] ?? null;
}

export function mediaFormatFromContentType(contentType: string): string {
  return (
    MEDIA_FORMAT_BY_CONTENT_TYPE[contentType] ??
    contentType.split('/').pop() ??
    contentType
  );
}
