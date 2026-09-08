import type { ConfigService } from '@nestjs/config';
import { NotFound } from '@aws-sdk/client-s3';
import { S3StorageProvider } from './s3-storage.provider';

/**
 * F9.7. Every signing case below reaches the AWS SDK's default credential
 * provider chain, and that chain is why Backend CI had been red since F9.4:
 * on a developer machine it quietly finds the AWS CLI profile in `~/.aws`
 * and signs, while on a runner it finds nothing and `getSignedUrl` throws
 * before any assertion runs. The suite therefore passed for whoever wrote it
 * and failed for everyone else — the failure arrived with F9.4's first
 * presign case and grew with each one F9.5 and F9.6 added.
 *
 * Static dummy credentials make the signature depend on nothing but this
 * file. They never reach a real endpoint: every case below inspects the
 * shape of a URL, and nothing here performs a request.
 */
process.env.AWS_ACCESS_KEY_ID = 'test-access-key-id';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-access-key';

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

/**
 * F9.6 — the read path. Before this there was none: rows stored the bucket's
 * canonical URL and the gallery pointed `<img src>` at it, which a bucket with
 * public access blocked answers with 403.
 */
describe('S3StorageProvider.getPresignedDownloadUrl', () => {
  const provider = makeProvider();
  const KEY = 'incidents/abc/uuid-foto.jpg';

  it('signs a GET for the key', async () => {
    const url = new URL(await provider.getPresignedDownloadUrl(KEY));
    expect(url.origin + url.pathname).toBe(`${ORIGIN}/${KEY}`);
    expect(url.searchParams.get('X-Amz-Signature')).toEqual(expect.any(String));
  });

  it('repeats the identical URL for repeated calls in the same window', async () => {
    // Not cosmetic. The gallery renders through `next/image`, which caches by
    // URL — a signature carrying a fresh `X-Amz-Date` per request is a fresh
    // cache key per request, so every page view would re-download and
    // re-optimize every photo.
    const [first, second] = await Promise.all([
      provider.getPresignedDownloadUrl(KEY),
      provider.getPresignedDownloadUrl(KEY),
    ]);
    expect(first).toBe(second);
  });

  it('signs an attachment disposition when a download filename is given', async () => {
    const url = new URL(
      await provider.getPresignedDownloadUrl(KEY, {
        downloadFilename: 'informe.pdf',
      }),
    );
    expect(url.searchParams.get('response-content-disposition')).toBe(
      'attachment; filename="informe.pdf"',
    );
    // The override is part of the signature, so it cannot be stripped or
    // rewritten by whoever holds the URL.
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
  });

  it('omits the disposition entirely when no filename is given', async () => {
    // Images and video have to stay inline or `<img>`/`<video>` cannot show them.
    const url = new URL(await provider.getPresignedDownloadUrl(KEY));
    expect(url.searchParams.get('response-content-disposition')).toBeNull();
  });

  it('neutralises a filename that would break out of the quoted header', async () => {
    // Names are stored free-form, so a quote or a newline here would end the
    // `filename="..."` field early and let the rest read as another header.
    const url = new URL(
      await provider.getPresignedDownloadUrl(KEY, {
        downloadFilename: 'evil".pdf\r\nX-Injected: 1',
      }),
    );
    const disposition = url.searchParams.get('response-content-disposition');
    expect(disposition).not.toContain('X-Injected: 1');
    expect(disposition).toMatch(/^attachment; filename="[a-zA-Z0-9._ -]*"$/);
  });
});
