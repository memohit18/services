import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getPagination } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse } from '../../../../common/utils/api-response';
import {
  FitForgeCacheKeys,
  FitForgeCacheTTL,
  RedisService,
} from '../../../infrastructure/redis/redis.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ConfirmUploadDto } from '../dto/confirm-upload.dto';
import { ListUploadsQueryDto } from '../dto/list-uploads-query.dto';
import { PresignedUploadDto } from '../dto/presigned-upload.dto';
import { R2StorageService } from './r2-storage.service';

type PendingUpload = {
  userId: string;
  key: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  category: string;
  photoType?: string;
};

@Injectable()
export class UploadsService {
  constructor(
    private readonly r2: R2StorageService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async createPresignedUrl(userId: string, dto: PresignedUploadDto) {
    const uploadId = randomUUID();
    const key = this.r2.buildObjectKey(userId, dto.fileName);
    const presigned = await this.r2.createPresignedUpload(key, dto.contentType);

    const pending: PendingUpload = {
      userId,
      key,
      fileName: dto.fileName,
      fileUrl: presigned.fileUrl,
      mimeType: dto.contentType,
      size: dto.size ?? 0,
      category: dto.category,
      photoType: dto.photoType,
    };
    await this.redis.set(
      FitForgeCacheKeys.pendingUpload(uploadId),
      pending,
      FitForgeCacheTTL.PENDING_UPLOAD,
    );

    return { uploadId, ...presigned, key };
  }

  async confirm(userId: string, dto: ConfirmUploadDto) {
    const pending = await this.redis.get<PendingUpload>(
      FitForgeCacheKeys.pendingUpload(dto.uploadId),
    );
    if (!pending || pending.userId !== userId) {
      throw new NotFoundException('Pending upload not found or expired');
    }

    const upload = await this.prisma.upload.create({
      data: {
        userId,
        fileName: pending.fileName,
        fileKey: pending.key,
        fileUrl: dto.fileUrl,
        mimeType: pending.mimeType,
        size: dto.size,
        category: pending.category,
      },
    });

    const photoType = dto.photoType ?? pending.photoType;
    if (
      pending.category === 'progress' &&
      photoType &&
      ['front', 'side', 'back'].includes(photoType)
    ) {
      const data =
        photoType === 'front'
          ? { frontImageUrl: dto.fileUrl }
          : photoType === 'side'
            ? { sideImageUrl: dto.fileUrl }
            : { backImageUrl: dto.fileUrl };

      const photo = await this.prisma.progressPhoto.create({
        data: { userId, ...data },
      });
      await this.redis.del(FitForgeCacheKeys.pendingUpload(dto.uploadId));
      return { upload, progressPhoto: photo };
    }

    await this.redis.del(FitForgeCacheKeys.pendingUpload(dto.uploadId));
    return { upload };
  }

  async list(userId: string, query: ListUploadsQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where = {
      userId,
      ...(query.category ? { category: query.category } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.upload.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.upload.count({ where }),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async remove(userId: string, id: string) {
    const upload = await this.prisma.upload.findFirst({
      where: { id, userId },
    });
    if (!upload) {
      throw new NotFoundException('Upload not found');
    }

    await this.r2.deleteObject(upload.fileKey);
    await this.prisma.upload.delete({ where: { id } });
    return { id };
  }
}
