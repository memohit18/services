import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
    this.publicUrl = (this.configService.get<string>('r2.publicUrl') ?? '').replace(/\/$/, '');

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

  async createPresignedUpload(key: string, contentType: string, expiresIn = 900) {
    this.ensureConfigured();
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client!, command, { expiresIn });
    const fileUrl = this.publicUrl ? `${this.publicUrl}/${key}` : key;
    return { uploadUrl, fileUrl, expiresIn };
  }

  buildObjectKey(userId: string, fileName: string) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `uploads/${userId}/${randomUUID()}-${safeName}`;
  }

  async deleteObject(key: string) {
    this.ensureConfigured();
    await this.client!.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  private ensureConfigured() {
    if (!this.client) {
      throw new ServiceUnavailableException('Cloudflare R2 is not configured');
    }
  }
}
