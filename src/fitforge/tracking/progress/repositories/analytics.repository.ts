import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ProgressRepository } from './progress.repository';

/**
 * Read model for analytics — loads progress series + active transformation.
 */
@Injectable()
export class AnalyticsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progressRepository: ProgressRepository,
  ) {}

  async loadAnalyticsContext(userId: string, from?: Date, to?: Date) {
    const [logs, transformation, profile, mealLogs, checkins] =
      await Promise.all([
        this.progressRepository.findAllAsc(userId, from, to),
        this.prisma.transformationTarget.findFirst({
          where: { userId, status: 'active' },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.userFitnessProfile.findUnique({ where: { userId } }),
        this.prisma.mealLog.findMany({
          where: {
            userId,
            ...(from || to
              ? {
                  consumedAt: {
                    ...(from ? { gte: from } : {}),
                    ...(to ? { lt: to } : {}),
                  },
                }
              : {}),
          },
          select: { status: true, consumedAt: true },
        }),
        this.prisma.dailyCheckin.findMany({
          where: {
            userId,
            ...(from || to
              ? {
                  checkInDate: {
                    ...(from ? { gte: from } : {}),
                    ...(to ? { lt: to } : {}),
                  },
                }
              : {}),
          },
          select: {
            checkInDate: true,
            workoutCompleted: true,
            mealsCompleted: true,
            mealsSkipped: true,
          },
          orderBy: { checkInDate: 'desc' },
          take: 90,
        }),
      ]);

    return { logs, transformation, profile, mealLogs, checkins };
  }
}
