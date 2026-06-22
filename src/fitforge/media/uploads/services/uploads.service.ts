import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  FitForgeCacheKeys,
  FitForgeCacheTTL,
  RedisService,
} from '../../../infrastructure/redis/redis.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ConfirmUploadDto } from '../dto/confirm-upload.dto';
import { PresignedUploadDto } from '../dto/presigned-upload.dto';
import { R2StorageService } from './r2-storage.service';

type PendingUpload = {
  userId: string;
  key: string;
  fileUrl: string;
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
      fileUrl: presigned.fileUrl,
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

    const photoType = dto.photoType ?? pending.photoType;
    if (photoType && ['front', 'side', 'back'].includes(photoType)) {
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
      return photo;
    }

    await this.redis.del(FitForgeCacheKeys.pendingUpload(dto.uploadId));
    return { fileUrl: dto.fileUrl, key: pending.key };
  }

  async remove(userId: string, id: string) {
    const photo = await this.prisma.progressPhoto.findFirst({
      where: { id, userId },
    });
    if (!photo) {
      throw new NotFoundException('Upload not found');
    }

    const urls = [photo.frontImageUrl, photo.sideImageUrl, photo.backImageUrl].filter(
      Boolean,
    ) as string[];
    for (const url of urls) {
      const key = this.extractKeyFromUrl(url);
      if (key) {
        await this.r2.deleteObject(key);
      }
    }

    await this.prisma.progressPhoto.delete({ where: { id } });
    return { id };
  }

  private extractKeyFromUrl(url: string) {
    try {
      const parsed = new URL(url);
      return parsed.pathname.replace(/^\//, '');
    } catch {
      return null;
    }
  }
}
