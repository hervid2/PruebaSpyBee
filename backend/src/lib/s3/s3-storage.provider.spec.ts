import type { ConfigService } from '@nestjs/config';
import { NotFound } from '@aws-sdk/client-s3';
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
    const { fileUrl } = await provider.getPresignedUploadUrl(
      key,
      'image/jpeg',
      1024,
    );
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

/**
 * F9.5. The size cap used to be checked against the number the client put in
 * its own presign request and then never again, so a caller could ask for a
 * URL claiming 1 KB and PUT gigabytes through it. Putting the length in the
 * signature is what turns the cap from advice into something S3 enforces.
 */
describe('S3StorageProvider.getPresignedUploadUrl', () => {
  const provider = makeProvider();

  async function presign(): Promise<URL> {
    const { uploadUrl } = await provider.getPresignedUploadUrl(
      'incidents/abc/uuid-foto.jpg',
      'image/jpeg',
      1024,
    );
    return new URL(uploadUrl);
  }

  it('signs content-length, so a PUT of any other size is rejected', async () => {
    const signed = (await presign()).searchParams.get('X-Amz-SignedHeaders');
    expect(signed?.split(';')).toContain('content-length');
  });

  it('does not sign content-type', async () => {
    // Not an oversight: `S3RequestPresigner` adds `content-type` to its
    // unsignable set because browsers rewrite the header, so pinning it here
    // would break real uploads. `MediaService.create` reads the type back off
    // the stored object instead of trusting either side of the wire.
    const signed = (await presign()).searchParams.get('X-Amz-SignedHeaders');
    expect(signed?.split(';')).not.toContain('content-type');
  });

  it('carries no precomputed checksum parameter', async () => {
    // Left to its default the SDK checksums the *empty* body it signs and
    // hoists `x-amz-checksum-crc32` into the query string, where S3 then
    // applies it to whatever the browser actually PUTs — failing every real
    // upload. `requestChecksumCalculation: 'WHEN_REQUIRED'` is what keeps this
    // out; this case is what would notice if it were removed.
    const params = [...(await presign()).searchParams.keys()];
    expect(params.filter((p) => p.startsWith('x-amz-checksum-'))).toEqual([]);
  });
});

/** F9.5 — the call that lets `create` describe an attachment from the object instead of from the request. */
describe('S3StorageProvider.headObject', () => {
  function providerWithSend(send: jest.Mock): ReturnType<typeof makeProvider> {
    const provider = makeProvider();
    (provider as unknown as { client: { send: jest.Mock } }).client.send = send;
    return provider;
  }

  it('reports the stored content type and byte length', async () => {
    const provider = providerWithSend(
      jest.fn().mockResolvedValue({
        ContentType: 'image/png',
        ContentLength: 2048,
      }),
    );
    await expect(provider.headObject('incidents/abc/x.png')).resolves.toEqual({
      contentType: 'image/png',
      size: 2048,
    });
  });

  it('returns null when nothing was ever uploaded to the key', async () => {
    const provider = providerWithSend(
      jest.fn().mockRejectedValue(new NotFound({ $metadata: {}, message: '' })),
    );
    await expect(
      provider.headObject('incidents/abc/x.png'),
    ).resolves.toBeNull();
  });

  it('propagates any other failure instead of reading it as "not uploaded"', async () => {
    // Flattening a denied or throttled HEAD into `null` would turn an
    // infrastructure problem into a 400 blaming the client, and would hide
    // the one signal that says the bucket policy is wrong.
    const provider = providerWithSend(
      jest.fn().mockRejectedValue(new Error('AccessDenied')),
    );
    await expect(provider.headObject('incidents/abc/x.png')).rejects.toThrow(
      'AccessDenied',
    );
  });
});
