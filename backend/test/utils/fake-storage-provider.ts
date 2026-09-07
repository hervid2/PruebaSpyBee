import type {
  PresignedUpload,
  StorageProvider,
  StoredObject,
} from '../../src/lib/s3/storage-provider.interface';

const FAKE_ORIGIN = 'https://fake-bucket.s3.fake-region.amazonaws.com';

/**
 * In-memory double for `S3StorageProvider` — no real AWS calls in e2e tests.
 * `resolveOwnKey` deliberately reimplements the real origin/prefix rule
 * rather than accepting everything: the specs that assert a forged `fileUrl`
 * is rejected (F9.4) would pass vacuously against a permissive double.
 *
 * `headObject` is backed by a map a spec fills with `putObject` (F9.5). The
 * browser's direct PUT is the one step of the upload no e2e test performs, so
 * staging it explicitly is what keeps "the object is there and is an image"
 * distinguishable from "the client presigned a URL and never uploaded" — the
 * case `MediaService.create` now rejects. Presigning deliberately does *not*
 * stage anything, so a spec that forgets to say what was uploaded fails
 * loudly instead of silently testing the happy path.
 */
export class FakeStorageProvider implements StorageProvider {
  readonly presignedCalls: {
    key: string;
    contentType: string;
    contentLength: number;
  }[] = [];
  readonly deletedKeys: string[] = [];
  readonly downloadCalls: { key: string; downloadFilename?: string }[] = [];
  private readonly objects = new Map<string, StoredObject>();

  getPresignedUploadUrl(
    key: string,
    contentType: string,
    contentLength: number,
  ): Promise<PresignedUpload> {
    this.presignedCalls.push({ key, contentType, contentLength });
    const fileUrl = this.publicUrlForKey(key);
    return Promise.resolve({
      uploadUrl: `${fileUrl}?X-Amz-Signature=fake`,
      fileUrl,
    });
  }

  /** Stands in for the browser's direct PUT: after this, `headObject(key)` sees an object. */
  putObject(key: string, object: StoredObject): void {
    this.objects.set(key, object);
  }

  /**
   * Mirrors the real provider's shape closely enough for the specs to tell a
   * signed read URL from the stored one, and to see the `attachment`
   * disposition documents get (F9.6) — without pulling in real signing.
   */
  getPresignedDownloadUrl(
    key: string,
    options: { downloadFilename?: string } = {},
  ): Promise<string> {
    this.downloadCalls.push({ key, ...options });
    const disposition = options.downloadFilename
      ? `&response-content-disposition=attachment%3B%20filename%3D%22${encodeURIComponent(options.downloadFilename)}%22`
      : '';
    return Promise.resolve(
      `${this.publicUrlForKey(key)}?X-Amz-Signature=fake-download${disposition}`,
    );
  }

  headObject(key: string): Promise<StoredObject | null> {
    return Promise.resolve(this.objects.get(key) ?? null);
  }

  deleteObject(key: string): Promise<void> {
    this.deletedKeys.push(key);
    this.objects.delete(key);
    return Promise.resolve();
  }

  resolveOwnKey(fileUrl: string, expectedPrefix: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(fileUrl);
    } catch {
      return null;
    }
    if (parsed.origin !== FAKE_ORIGIN) return null;
    const key = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (!key || key.includes('..')) return null;
    return key.startsWith(expectedPrefix) ? key : null;
  }

  publicUrlForKey(key: string): string {
    return `${FAKE_ORIGIN}/${key}`;
  }
}
