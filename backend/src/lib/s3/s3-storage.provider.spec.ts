import type { ConfigService } from '@nestjs/config';
import { S3StorageProvider } from './s3-storage.provider';

const BUCKET = 'flyworkflow-media';
const REGION = 'us-east-1';
const ORIGIN = `https://${BUCKET}.s3.${REGION}.amazonaws.com`;

function makeProvider(): S3StorageProvider {
  const config = {
    getOrThrow: (key: string) => (key === 'AWS_REGION' ? REGION : BUCKET),
    get: () => undefined,
  } as unknown as ConfigService;
  return new S3StorageProvider(config);
}

/**
 * F9.4. `fileUrl` reaches `MediaService.create`/`ProjectPlansService.create`
 * straight from the browser after its direct PUT to S3, and the value is both
 * rendered (gallery `<img src>`, documents `<a href>`) and, later, turned back
 * into the key that gets deleted. These cases are the boundary that makes it
 * safe to do either.
 */
describe('S3StorageProvider.resolveOwnKey', () => {
  const provider = makeProvider();
  const prefix = 'incidents/abc/';

  it('accepts a URL this provider issued for the expected prefix', () => {
    const { fileUrl } = { fileUrl: `${ORIGIN}/incidents/abc/uuid-plano.png` };
    expect(provider.resolveOwnKey(fileUrl, prefix)).toBe(
      'incidents/abc/uuid-plano.png',
    );
  });

  it('round-trips the URL it hands out at presign time', async () => {
    const key = 'incidents/abc/uuid-foto.jpg';
    const { fileUrl } = await provider.getPresignedUploadUrl(key, 'image/jpeg');
    expect(provider.resolveOwnKey(fileUrl, prefix)).toBe(key);
  });

  it('decodes a percent-encoded key back to the stored form', () => {
    expect(
      provider.resolveOwnKey(`${ORIGIN}/incidents/abc/uuid-a%20b.png`, prefix),
    ).toBe('incidents/abc/uuid-a b.png');
  });

  it.each([
    [
      'a host the attacker controls',
      'https://attacker.test/incidents/abc/x.png',
    ],
    [
      'a lookalike host',
      'https://flyworkflow-media.s3.evil.com/incidents/abc/x.png',
    ],
    [
      'the same host over plain http',
      `http://${BUCKET}.s3.${REGION}.amazonaws.com/incidents/abc/x.png`,
    ],
    ['a javascript: URL', 'javascript:alert(document.cookie)'],
    [
      'a data: URL',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    ],
    ['not a URL at all', 'incidents/abc/x.png'],
  ])('rejects %s', (_label, fileUrl) => {
    expect(provider.resolveOwnKey(fileUrl, prefix)).toBeNull();
  });

  it("rejects our own bucket but another resource's key", () => {
    // The delete path turns the stored URL into the key it erases, so a key
    // outside this incident's namespace is how one tenant would reach
    // another tenant's object.
    expect(
      provider.resolveOwnKey(`${ORIGIN}/incidents/victim/secret.png`, prefix),
    ).toBeNull();
  });

  it('rejects a percent-encoded traversal that survives URL normalization', () => {
    // A literal `../` is collapsed by `new URL` before the prefix check ever
    // runs; `%2e%2e` is not, and comes back out of `decodeURIComponent` as a
    // key that passes the prefix check while pointing outside the prefix.
    expect(
      provider.resolveOwnKey(
        `${ORIGIN}/incidents/abc/%2e%2e/victim/x.png`,
        prefix,
      ),
    ).toBeNull();
  });

  it('rejects the bucket root', () => {
    expect(provider.resolveOwnKey(ORIGIN, prefix)).toBeNull();
  });
});
