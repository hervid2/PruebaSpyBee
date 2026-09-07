export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface PresignedUpload {
  uploadUrl: string;
  fileUrl: string;
}

/** What the bucket itself says an object is, once it has actually been written (F9.5). */
export interface StoredObject {
  /** The `Content-Type` S3 recorded, or `null` if the object carries none. */
  contentType: string | null;
  /** The object's real byte length, as opposed to whatever the client claimed. */
  size: number;
}

/**
 * Abstraction over the object storage backend (`best-practices.md §NestJS`,
 * dependency inversion): business services depend on this interface, never
 * on `@aws-sdk/client-s3` directly, so they stay swappable/testable without
 * a real AWS account.
 */
export interface StorageProvider {
  /**
   * Signs a single PUT of exactly `contentLength` bytes to `key`.
   *
   * The size is part of the signature, not advice (F9.5). Before that, the
   * only size check in the flow ran against the number the client put in its
   * own presign request, so a caller could declare 1 KB, receive a URL, and
   * PUT gigabytes through it — the cap bounded the claim, never the upload.
   */
  getPresignedUploadUrl(
    key: string,
    contentType: string,
    contentLength: number,
  ): Promise<PresignedUpload>;

  /**
   * What is actually at `key`, or `null` if nothing is (F9.5). This is the
   * call that lets a service record an attachment from the object rather than
   * from the client's description of it: presigning and recording are two
   * separate requests, and nothing in between proves the PUT ever happened or
   * that it wrote what it said it would.
   */
  headObject(key: string): Promise<StoredObject | null>;

  /**
   * A URL that actually reads the object (F9.6).
   *
   * Until this existed there was no read path at all: rows stored the bucket's
   * canonical URL and the gallery pointed `<img src>` straight at it, which a
   * bucket with public access blocked answers with 403. The demo never showed
   * it because the seeded media points at picsum.photos.
   *
   * `downloadFilename` signs `ResponseContentDisposition: attachment`, which
   * is what stops a PDF from rendering on the bucket's own origin — the
   * hardening F9.5 wanted and had nowhere to put. It is a *response* override
   * carried in the signature, so the server decides it; the PUT-time header
   * alternative would have to be sent back verbatim by the browser.
   */
  getPresignedDownloadUrl(
    key: string,
    options?: { downloadFilename?: string },
  ): Promise<string>;

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
