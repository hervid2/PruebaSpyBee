export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface PresignedUpload {
  uploadUrl: string;
  fileUrl: string;
}

/**
 * Abstraction over the object storage backend (`best-practices.md §NestJS`,
 * dependency inversion): business services depend on this interface, never
 * on `@aws-sdk/client-s3` directly, so they stay swappable/testable without
 * a real AWS account.
 */
export interface StorageProvider {
  getPresignedUploadUrl(
    key: string,
    contentType: string,
  ): Promise<PresignedUpload>;
  deleteObject(key: string): Promise<void>;

  /**
   * Maps a `fileUrl` the client hands back after its direct PUT to the object
   * key it refers to — `null` when this provider could not have issued that
   * URL, or when the key falls outside `expectedPrefix` (F9.4).
   *
   * The two-step upload (presign, then the client reports the URL it wrote
   * to) means `fileUrl` arrives over the wire from the browser and is not
   * trustworthy on its own: nothing else ties the value the client sends back
   * to the key the server just signed for. Without this check a caller can
   * name any URL at all — one on a host they control, which the gallery then
   * renders as `<img src>`/`<a href>`, or one naming a *different* tenant's
   * object, which the delete path would then erase from this bucket.
   */
  resolveOwnKey(fileUrl: string, expectedPrefix: string): string | null;

  /** The canonical, stable URL for a key — what gets persisted, so a row never stores client text verbatim. */
  publicUrlForKey(key: string): string;
}
