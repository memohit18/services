import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { getPagination } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import type { ImageFormatUrls } from '../../../../../db-schema/mongodb/schemas/user-image.schema';
import {
  FitForgeCacheKeys,
  FitForgeCacheTTL,
  RedisService,
} from '../../../infrastructure/redis/redis.service';
import { R2StorageService } from '../../uploads/services/r2-storage.service';
import { ListImagesQueryDto } from '../dto/upload-image.dto';
import { UserImageRepository } from '../repositories/user-image.repository';
import {
  IMAGE_SIZES,
  ImageOptimizeService,
  type OptimizedSizeName,
} from './image-optimize.service';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/heic',
  'image/heif',
]);

const LOCK_PREFIX = 'lock:';
const DEDUPE_POLL_MS = 250;
const DEDUPE_WAIT_MS = 90_000;

type ImageApiResult = {
  id: string;
  userId: string;
  type: string;
  originalFileName: string;
  folderPath: string;
  blurDataUrl: string;
  images: {
    original: ImageFormatUrls;
    thumbnail: ImageFormatUrls;
    small: ImageFormatUrls;
    medium: ImageFormatUrls;
    large: ImageFormatUrls;
  };
  createdAt?: Date;
  updatedAt?: Date;
  deduped?: boolean;
};

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  /** Same-process concurrent POST /images (e.g. React Strict Mode / double click). */
  private readonly inFlight = new Map<string, Promise<ImageApiResult>>();

  constructor(
    private readonly optimize: ImageOptimizeService,
    private readonly r2: R2StorageService,
    private readonly repository: UserImageRepository,
    private readonly redis: RedisService,
  ) {}

  async upload(
    userId: string,
    type: string,
    file: Express.Multer.File | undefined,
    idempotencyKey?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required (field name: file)');
    }
    if (file.mimetype && !ALLOWED_MIME.has(file.mimetype.toLowerCase())) {
      throw new BadRequestException(
        `Unsupported content type: ${file.mimetype}. Use jpeg, png, webp, avif, gif, or heic.`,
      );
    }

    const safeType = type.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
    const contentHash = createHash('sha256').update(file.buffer).digest('hex');
    const fingerprint =
      idempotencyKey?.trim() ||
      `${safeType}:${contentHash}:${file.originalname || 'file'}`;
    const dedupeKey = FitForgeCacheKeys.imageUploadDedupe(userId, fingerprint);

    const existingInFlight = this.inFlight.get(dedupeKey);
    if (existingInFlight) {
      const result = await existingInFlight;
      return { ...result, deduped: true };
    }

    const cached = await this.redis.get<ImageApiResult>(dedupeKey);
    if (cached && !this.isLockPayload(cached)) {
      return { ...cached, deduped: true };
    }

    const work = this.runExclusiveUpload({
      userId,
      safeType,
      file,
      dedupeKey,
    });
    this.inFlight.set(dedupeKey, work);

    try {
      return await work;
    } finally {
      this.inFlight.delete(dedupeKey);
    }
  }

  private async runExclusiveUpload(params: {
    userId: string;
    safeType: string;
    file: Express.Multer.File;
    dedupeKey: string;
  }): Promise<ImageApiResult> {
    const { userId, safeType, file, dedupeKey } = params;
    const lockToken = `${LOCK_PREFIX}${randomUUID()}`;
    const acquired = await this.redis.setNx(
      dedupeKey,
      lockToken,
      FitForgeCacheTTL.IMAGE_UPLOAD_DEDUPE,
    );

    if (!acquired) {
      const waited = await this.waitForCachedResult(dedupeKey);
      if (waited) {
        return { ...waited, deduped: true };
      }
      throw new ConflictException(
        'A duplicate upload is already in progress. Retry in a moment.',
      );
    }

    try {
      const result = await this.persistOptimizedUpload(userId, safeType, file);
      await this.redis.set(
        dedupeKey,
        result,
        FitForgeCacheTTL.IMAGE_UPLOAD_DEDUPE,
      );
      return result;
    } catch (error) {
      await this.redis.del(dedupeKey);
      throw error;
    }
  }

  private async waitForCachedResult(
    dedupeKey: string,
  ): Promise<ImageApiResult | null> {
    const deadline = Date.now() + DEDUPE_WAIT_MS;
    while (Date.now() < deadline) {
      const raw = await this.redis.getRaw(dedupeKey);
      if (!raw) {
        return null;
      }
      if (!raw.startsWith('"') && !raw.startsWith('{') && raw.startsWith(LOCK_PREFIX)) {
        await this.sleep(DEDUPE_POLL_MS);
        continue;
      }
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === 'string' && parsed.startsWith(LOCK_PREFIX)) {
          await this.sleep(DEDUPE_POLL_MS);
          continue;
        }
        if (parsed && typeof parsed === 'object' && 'id' in parsed) {
          return parsed as ImageApiResult;
        }
      } catch {
        if (raw.startsWith(LOCK_PREFIX)) {
          await this.sleep(DEDUPE_POLL_MS);
          continue;
        }
      }
      await this.sleep(DEDUPE_POLL_MS);
    }
    this.logger.warn(`Timed out waiting for dedupe key ${dedupeKey}`);
    return null;
  }

  private isLockPayload(value: unknown): boolean {
    return typeof value === 'string' && value.startsWith(LOCK_PREFIX);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async persistOptimizedUpload(
    userId: string,
    safeType: string,
    file: Express.Multer.File,
  ) {
    const imageId = randomUUID();
    const folderPath = this.r2.buildUserImageFolder(userId, safeType, imageId);
    const optimized = await this.optimize.optimize(file.buffer);

    const keys: string[] = [];
    const variantDocs: Record<OptimizedSizeName, ImageFormatUrls> = {} as Record<
      OptimizedSizeName,
      ImageFormatUrls
    >;

    for (const sizeName of Object.keys(IMAGE_SIZES) as OptimizedSizeName[]) {
      const variant = optimized.variants[sizeName];
      const uploads = await Promise.all(
        (
          [
            ['webp', 'image/webp', variant.webp],
            ['jpeg', 'image/jpeg', variant.jpeg],
            ['avif', 'image/avif', variant.avif],
          ] as const
        ).map(async ([ext, contentType, body]) => {
          const key = `${folderPath}/${sizeName}.${ext === 'jpeg' ? 'jpg' : ext}`;
          const uploaded = await this.r2.putObject(key, body, contentType);
          keys.push(uploaded.key);
          return { ext, uploaded };
        }),
      );

      const byExt = Object.fromEntries(
        uploads.map((u) => [u.ext, u.uploaded]),
      ) as Record<'webp' | 'jpeg' | 'avif', { url: string; bytes: number; key: string }>;

      variantDocs[sizeName] = {
        webp: byExt.webp.url,
        jpeg: byExt.jpeg.url,
        avif: byExt.avif.url,
        width: variant.width,
        height: variant.height,
        bytes: byExt.webp.bytes + byExt.jpeg.bytes + byExt.avif.bytes,
      };
    }

    const doc = await this.repository.create({
      userId,
      type: safeType,
      originalFileName: file.originalname,
      folderPath,
      keys,
      blurDataUrl: optimized.blurDataUrl,
      original: variantDocs.original,
      thumbnail: variantDocs.thumbnail,
      small: variantDocs.small,
      medium: variantDocs.medium,
      large: variantDocs.large,
    });

    return this.toApi(doc.toObject());
  }

  async list(userId: string, query: ListImagesQueryDto) {
    const { page, limit, skip } = getPagination({
      page: query.page,
      limit: query.limit,
    });
    const [items, total] = await this.repository.findManyForUser(userId, {
      type: query.type?.toLowerCase(),
      skip,
      take: limit,
    });
    return paginatedResponse(
      items.map((item) => this.toApi(item)),
      total,
      page,
      limit,
    );
  }

  async getOne(userId: string, id: string) {
    const doc = await this.repository.findByIdForUser(id, userId);
    if (!doc) {
      throw new NotFoundException('Image not found');
    }
    return this.toApi(doc.toObject());
  }

  async remove(userId: string, id: string) {
    const doc = await this.repository.deleteByIdForUser(id, userId);
    if (!doc) {
      throw new NotFoundException('Image not found');
    }
    if (doc.keys?.length) {
      await this.r2.deleteObjects(doc.keys);
    }
    return {
      id: String(doc._id),
      folderPath: doc.folderPath,
      deletedKeys: doc.keys?.length ?? 0,
    };
  }

  /**
   * Delete by folder path, object key, or full CDN URL.
   * Removes all R2 variants + MongoDB user_images row.
   */
  async removeByPath(
    userId: string,
    input: { path?: string; folderPath?: string; url?: string },
  ) {
    const raw = (input.folderPath || input.path || input.url || '').trim();
    if (!raw) {
      throw new BadRequestException(
        'Provide path, folderPath, or url to delete the image',
      );
    }

    const resolved = this.resolveStoragePath(raw, userId);
    this.assertOwnedPath(resolved.folderPath, userId);

    let doc =
      (await this.repository.findByFolderPathForUser(
        resolved.folderPath,
        userId,
      )) ??
      (resolved.objectKey
        ? await this.repository.findByKeyForUser(resolved.objectKey, userId)
        : null);

    if (!doc) {
      throw new NotFoundException('Image not found for that path');
    }

    const deleted = await this.repository.deleteByIdForUser(
      String(doc._id),
      userId,
    );
    if (!deleted) {
      throw new NotFoundException('Image not found');
    }

    if (deleted.keys?.length) {
      await this.r2.deleteObjects(deleted.keys);
    }

    return {
      id: String(deleted._id),
      folderPath: deleted.folderPath,
      deletedKeys: deleted.keys?.length ?? 0,
    };
  }

  /**
   * Accepts:
   * - uploads/{userId}/{type}/{imageId}
   * - uploads/{userId}/{type}/{imageId}/medium.webp
   * - https://cdn.../uploads/{userId}/{type}/{imageId}/medium.webp
   */
  private resolveStoragePath(input: string, userId: string) {
    let path = input.trim();
    try {
      if (/^https?:\/\//i.test(path)) {
        path = new URL(path).pathname.replace(/^\/+/, '');
      }
    } catch {
      throw new BadRequestException('Invalid image URL');
    }

    path = path.replace(/^\/+/, '');
    const publicBase = this.r2.getPublicUrl().replace(/^https?:\/\//i, '');
    if (publicBase && path.startsWith(publicBase)) {
      path = path.slice(publicBase.length).replace(/^\/+/, '');
    }

    const parts = path.split('/').filter(Boolean);
    if (parts[0] !== 'uploads' || parts.length < 4) {
      throw new BadRequestException(
        'Expected path like uploads/{userId}/{type}/{imageId}[/file.ext]',
      );
    }

    const folderPath = parts.slice(0, 4).join('/');
    const objectKey = parts.length > 4 ? parts.join('/') : undefined;

    if (!folderPath.startsWith(`uploads/${userId}/`)) {
      throw new BadRequestException('You can only delete your own images');
    }

    return { folderPath, objectKey };
  }

  private assertOwnedPath(folderPath: string, userId: string) {
    if (!folderPath.startsWith(`uploads/${userId}/`)) {
      throw new BadRequestException('You can only delete your own images');
    }
  }

  private toApi(doc: {
    _id?: { toString(): string } | string;
    userId: string;
    type: string;
    originalFileName: string;
    folderPath: string;
    blurDataUrl: string;
    original: ImageFormatUrls;
    thumbnail: ImageFormatUrls;
    small: ImageFormatUrls;
    medium: ImageFormatUrls;
    large: ImageFormatUrls;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    const id =
      typeof doc._id === 'string' ? doc._id : doc._id?.toString() ?? '';
    return {
      id,
      userId: doc.userId,
      type: doc.type,
      originalFileName: doc.originalFileName,
      folderPath: doc.folderPath,
      blurDataUrl: doc.blurDataUrl,
      images: {
        original: doc.original,
        thumbnail: doc.thumbnail,
        small: doc.small,
        medium: doc.medium,
        large: doc.large,
      },
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
