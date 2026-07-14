import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getPagination } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import type { ImageFormatUrls } from '../../../../../db-schema/mongodb/schemas/user-image.schema';
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

@Injectable()
export class ImagesService {
  constructor(
    private readonly optimize: ImageOptimizeService,
    private readonly r2: R2StorageService,
    private readonly repository: UserImageRepository,
  ) {}

  async upload(
    userId: string,
    type: string,
    file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required (field name: file)');
    }
    if (file.mimetype && !ALLOWED_MIME.has(file.mimetype.toLowerCase())) {
      throw new BadRequestException(
        `Unsupported content type: ${file.mimetype}. Use jpeg, png, webp, avif, gif, or heic.`,
      );
    }

    const imageId = randomUUID();
    const safeType = type.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
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
    return { id: String(doc._id), folderPath: doc.folderPath };
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
      /** Prefer AVIF → WebP → JPEG via Accept on the client / CDN. */
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
