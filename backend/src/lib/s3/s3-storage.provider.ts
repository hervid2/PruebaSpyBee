import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  PresignedUpload,
  StorageProvider,
  StoredObject,
} from './storage-provider.interface';
import { DEFAULT_PRESIGNED_URL_EXPIRES_IN_SECONDS } from './s3.constants';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly expiresInSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.getOrThrow<string>('AWS_REGION');
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET_NAME');
    this.expiresInSeconds = Number(
      this.configService.get<string>('S3_PRESIGNED_URL_EXPIRES_IN_SECONDS') ??
        DEFAULT_PRESIGNED_URL_EXPIRES_IN_SECONDS,
    );
    // Credentials come from the default provider chain (the Lambda execution
    // role in AWS, a local AWS CLI profile in dev) — never a key/secret read
    // from this app's own config, per best-practices.md §Security.
    this.client = new S3Client({
      region: this.region,
      // Without this the SDK computes a CRC32 of the (empty) body at signing
      // time and hoists `x-amz-checksum-crc32` into the presigned URL's query
      // string, where S3 reads it back as the expected checksum of whatever
      // the browser then PUTs — so every real upload is checked against the
      // digest of nothing and rejected. PutObject does not require a checksum,
      // so asking for one only "when required" removes the parameter entirely.
      // See the round-trip case in this provider's spec, which asserts the
      // presigned URL carries no `x-amz-checksum-*`.
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    contentLength: number,
  ): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      // Signed, and therefore binding: `content-length` lands in
      // `X-Amz-SignedHeaders`, so S3 rejects a PUT whose body is any other
      // size (F9.5). `ContentType` cannot be made binding the same way —
      // `S3RequestPresigner` adds `content-type` to its unsignable set on
      // purpose, because browsers rewrite the header — which is why the real
      // type is read back off the stored object instead (`headObject`).
      ContentLength: contentLength,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.expiresInSeconds,
    });
    return { uploadUrl, fileUrl: this.publicUrlForKey(key) };
  }

  async headObject(key: string): Promise<StoredObject | null> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        contentType: head.ContentType ?? null,
        size: head.ContentLength ?? 0,
      };
    } catch (error) {
      // A missing object is the ordinary "the client never completed its PUT"
      // case and is the caller's to report; anything else (denied, throttled,
      // network) must not be flattened into "not uploaded".
      if (error instanceof NotFound) return null;
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /** See `StorageProvider.resolveOwnKey` — the origin check is what makes the key trustworthy. */
  resolveOwnKey(fileUrl: string, expectedPrefix: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(fileUrl);
    } catch {
      return null;
    }
    // Comparing whole origins (not `hostname.endsWith(...)`) also pins the
    // scheme: `http://<bucket>.s3.<region>.amazonaws.com` is a different
    // origin and is rejected, as is any lookalike host.
    if (parsed.origin !== this.publicOrigin) return null;

    const key = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    // `new URL` collapses a literal `../` before the prefix check below ever
    // sees it, but leaves `%2e%2e` alone — which `decodeURIComponent` then
    // turns back into a segment that satisfies the prefix while naming a key
    // outside it. No key this provider issues contains `..`, so refusing it
    // outright closes that gap.
    if (!key || key.includes('..')) return null;
    return key.startsWith(expectedPrefix) ? key : null;
  }

  publicUrlForKey(key: string): string {
    return `${this.publicOrigin}/${key}`;
  }

  private get publicOrigin(): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
  }
}
