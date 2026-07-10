import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ProgressRepository } from './progress.repository';

/**
 * Read model for analytics — loads progress series + active transformation.
 */
@Injectable()
export class AnalyticsRepository {
  private readonly logger = new Logger(AnalyticsRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly progressRepository: ProgressRepository,
  ) {}

  async loadAnalyticsContext(userId: string, from?: Date, to?: Date) {
    const [logs, transformation, profile, mealLogs, checkins, workoutSessions] =
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
        this.loadWorkoutSessions(userId, from, to),
      ]);

    return {
      logs,
      transformation,
      profile,
      mealLogs,
      checkins,
      workoutSessions,
    };
  }

  /**
   * WorkoutSessionLog may not exist until migration
   * `20260710230000_hydration_workout_session_events` is applied.
   * Fail soft so analytics still works on older DBs.
   */
  private async loadWorkoutSessions(userId: string, from?: Date, to?: Date) {
    try {
      return await this.prisma.workoutSessionLog.findMany({
        where: {
          userId,
          ...(from || to
            ? {
                OR: [
                  {
                    completedAt: {
                      ...(from ? { gte: from } : {}),
                      ...(to ? { lt: to } : {}),
                    },
                  },
                  {
                    completedAt: null,
                    createdAt: {
                      ...(from ? { gte: from } : {}),
                      ...(to ? { lt: to } : {}),
                    },
                  },
                ],
              }
            : {}),
        },
        select: {
          status: true,
          completedAt: true,
          createdAt: true,
        },
        take: 200,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2021'
      ) {
        this.logger.warn(
          'WorkoutSessionLog table missing — run npm run deploy:db. Analytics continuing without session logs.',
        );
        return [];
      }
      throw err;
    }
  }
}
