import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class HydrationLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.HydrationLogCreateInput) {
    return this.prisma.hydrationLog.create({ data });
  }

  findForDay(userId: string, start: Date, end: Date) {
    return this.prisma.hydrationLog.findMany({
      where: {
        userId,
        loggedAt: { gte: start, lt: end },
      },
      orderBy: { loggedAt: 'asc' },
    });
  }

  sumForDay(userId: string, start: Date, end: Date) {
    return this.prisma.hydrationLog.aggregate({
      where: {
        userId,
        loggedAt: { gte: start, lt: end },
      },
      _sum: { amountMl: true },
    });
  }
}
