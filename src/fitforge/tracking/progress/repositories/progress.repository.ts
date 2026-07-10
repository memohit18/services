import { Injectable } from '@nestjs/common';
import type { Prisma, ProgressLog } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class ProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ProgressLogCreateInput): Promise<ProgressLog> {
    return this.prisma.progressLog.create({ data });
  }

  update(id: string, data: Prisma.ProgressLogUpdateInput): Promise<ProgressLog> {
    return this.prisma.progressLog.update({ where: { id }, data });
  }

  findById(id: string, userId: string) {
    return this.prisma.progressLog.findFirst({ where: { id, userId } });
  }

  findLatest(userId: string) {
    return this.prisma.progressLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findForDay(userId: string, dayStart: Date, dayEnd: Date) {
    return this.prisma.progressLog.findFirst({
      where: {
        userId,
        createdAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findHistory(params: {
    userId: string;
    skip: number;
    take: number;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.ProgressLogWhereInput = {
      userId: params.userId,
      ...(params.from || params.to
        ? {
            createdAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lt: params.to } : {}),
            },
          }
        : {}),
    };

    return Promise.all([
      this.prisma.progressLog.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.progressLog.count({ where }),
    ]);
  }

  findAllAsc(userId: string, from?: Date, to?: Date) {
    return this.prisma.progressLog.findMany({
      where: {
        userId,
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lt: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
