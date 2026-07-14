import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Injectable()
export class R2StorageService {
  private client: S3Client | null = null;
  private bucket = '';
  private publicUrl = '';

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('r2.accountId');
    const accessKeyId = this.configService.get<string>('r2.accessKeyId');
    const secretAccessKey = this.configService.get<string>('r2.secretAccessKey');
    this.bucket = this.configService.get<string>('r2.bucket') ?? '';
    this.publicUrl = (
      this.configService.get<string>('r2.publicUrl') ?? ''
    ).replace(/\/$/, '');

    if (accountId && accessKeyId && secretAccessKey && this.bucket) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  getPublicUrl(): string {
    return this.publicUrl;
  }

  /** Legacy single-file key for progress photo presign flow. */
  buildObjectKey(userId: string, fileName: string) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `uploads/${userId}/${randomUUID()}-${safeName}`;
  }

  /**
   * User-scoped folder for optimized assets.
   * uploads/{userId}/{type}/{imageId}
   */
  buildUserImageFolder(userId: string, type: string, imageId: string) {
    const safeType = type.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
    return `uploads/${userId}/${safeType}/${imageId}`;
  }

  publicUrlForKey(key: string) {
    return this.publicUrl ? `${this.publicUrl}/${key}` : key;
  }

  async createPresignedUpload(key: string, contentType: string, expiresIn = 900) {
    this.ensureConfigured();
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client!, command, { expiresIn });
    const fileUrl = this.publicUrlForKey(key);
    return { uploadUrl, fileUrl, expiresIn };
  }

  async putObject(key: string, body: Buffer, contentType: string) {
    this.ensureConfigured();
    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return {
      key,
      url: this.publicUrlForKey(key),
      bytes: body.length,
    };
  }

  async deleteObject(key: string) {
    this.ensureConfigured();
    await this.client!.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async deleteObjects(keys: string[]) {
    if (keys.length === 0) {
      return;
    }
    this.ensureConfigured();
    // R2/S3 DeleteObjects caps at 1000 keys per request
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);
      await this.client!.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: chunk.map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
    }
  }

  private ensureConfigured() {
    if (!this.client) {
      throw new ServiceUnavailableException('Cloudflare R2 is not configured');
    }
  }
}
