import { Injectable } from '@nestjs/common';
import type { Prisma, ProgressPhoto } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class PhotoRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ProgressPhotoCreateInput): Promise<ProgressPhoto> {
    return this.prisma.progressPhoto.create({ data });
  }

  findById(id: string, userId: string) {
    return this.prisma.progressPhoto.findFirst({ where: { id, userId } });
  }

  findTimeline(userId: string, skip: number, take: number) {
    const where = { userId };
    return Promise.all([
      this.prisma.progressPhoto.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.progressPhoto.count({ where }),
    ]);
  }

  delete(id: string) {
    return this.prisma.progressPhoto.delete({ where: { id } });
  }
}
