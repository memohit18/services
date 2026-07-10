import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  aggregateDailyCheckin,
  dayBoundsUtc,
  startOfLocalCalendarDay,
} from '../aggregator/daily-aggregator.engine';
import { DailyCheckinRepository } from '../repositories/daily-checkin.repository';
import { HydrationLogRepository } from '../repositories/hydration-log.repository';
import { WorkoutSessionLogRepository } from '../repositories/workout-session-log.repository';

@Injectable()
export class DailyAggregatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyCheckinRepository: DailyCheckinRepository,
    private readonly hydrationLogRepository: HydrationLogRepository,
    private readonly workoutSessionLogRepository: WorkoutSessionLogRepository,
  ) {}

  /**
   * Rebuild DailyCheckin for a calendar day from meal / hydration /
   * workout-session / progress raw events.
   */
  async rebuildForDate(userId: string, day: Date = startOfLocalCalendarDay()) {
    const checkInDate = startOfLocalCalendarDay(day);
    const { start, end } = dayBoundsUtc(checkInDate);

    const [
      mealLogs,
      hydrationLogs,
      workoutSessions,
      progressLogs,
      dietPlan,
      workoutPlan,
      existing,
    ] = await Promise.all([
      this.prisma.mealLog.findMany({
        where: {
          userId,
          OR: [
            { consumedAt: { gte: start, lt: end } },
            {
              consumedAt: null,
              createdAt: { gte: start, lt: end },
            },
          ],
        },
        select: {
          status: true,
          actualCalories: true,
          actualProtein: true,
        },
      }),
      this.hydrationLogRepository.findForDay(userId, start, end),
      this.workoutSessionLogRepository.findForDay(userId, start, end),
      this.prisma.progressLog.findMany({
        where: {
          userId,
          createdAt: { gte: start, lt: end },
        },
        orderBy: { createdAt: 'desc' },
        select: { weightKg: true, notes: true },
      }),
      this.prisma.dietPlan.findFirst({
        where: { userId, status: 'active' },
        select: { id: true },
      }),
      this.prisma.workoutPlan.findFirst({
        where: { userId, status: 'active' },
        select: { id: true },
      }),
      this.dailyCheckinRepository.findByUserAndDate(userId, checkInDate),
    ]);

    const aggregated = aggregateDailyCheckin({
      mealLogs,
      hydrationLogs,
      workoutSessions,
      progressLogs,
      dietPlanId: dietPlan?.id ?? null,
      workoutPlanId: workoutPlan?.id ?? null,
      existingNotes: existing?.notes ?? null,
    });

    return this.dailyCheckinRepository.upsert(userId, checkInDate, {
      dietPlanId: aggregated.dietPlanId,
      workoutPlanId: aggregated.workoutPlanId,
      weightKg: aggregated.weightKg,
      caloriesConsumed: aggregated.caloriesConsumed,
      proteinConsumed: aggregated.proteinConsumed,
      waterIntakeMl: aggregated.waterIntakeMl,
      mealsCompleted: aggregated.mealsCompleted,
      mealsSkipped: aggregated.mealsSkipped,
      dietCompliance: aggregated.dietCompliance,
      workoutCompleted: aggregated.workoutCompleted,
      notes: aggregated.notes,
      aggregatedAt: new Date(),
    });
  }
}
