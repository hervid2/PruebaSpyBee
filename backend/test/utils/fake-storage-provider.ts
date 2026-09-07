import type {
  PresignedUpload,
  StorageProvider,
} from '../../src/lib/s3/storage-provider.interface';

const FAKE_ORIGIN = 'https://fake-bucket.s3.fake-region.amazonaws.com';

/**
 * In-memory double for `S3StorageProvider` — no real AWS calls in e2e tests.
 * `resolveOwnKey` deliberately reimplements the real origin/prefix rule
 * rather than accepting everything: the specs that assert a forged `fileUrl`
 * is rejected (F9.4) would pass vacuously against a permissive double.
 */
export class FakeStorageProvider implements StorageProvider {
  readonly presignedCalls: { key: string; contentType: string }[] = [];
  readonly deletedKeys: string[] = [];

  getPresignedUploadUrl(
    key: string,
    contentType: string,
  ): Promise<PresignedUpload> {
    this.presignedCalls.push({ key, contentType });
    const fileUrl = this.publicUrlForKey(key);
    return Promise.resolve({
      uploadUrl: `${fileUrl}?X-Amz-Signature=fake`,
      fileUrl,
    });
  }

  deleteObject(key: string): Promise<void> {
    this.deletedKeys.push(key);
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
