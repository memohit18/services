import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  dayBoundsUtc,
  startOfLocalCalendarDay,
} from '../../checkins/aggregator/daily-aggregator.engine';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveTransformationTargets(userId: string) {
    return this.prisma.transformationTarget.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        dailyCalorieTarget: true,
        proteinTarget: true,
      },
    });
  }

  findActiveDietTargets(userId: string) {
    return this.prisma.dietPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        caloriesTarget: true,
        proteinTarget: true,
      },
    });
  }

  async countAssignedMealsToday(userId: string, day = startOfLocalCalendarDay()) {
    const plan = await this.prisma.mealPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { version: 'desc' },
      include: {
        items: { select: { id: true, dayNumber: true } },
      },
    });
    if (!plan || plan.items.length === 0) {
      return 0;
    }

    const maxDay = plan.items.reduce(
      (max, item) => Math.max(max, item.dayNumber),
      7,
    );
    let dayNumber: number;
    if (plan.startDate) {
      const start = startOfLocalCalendarDay(plan.startDate);
      const diffDays = Math.floor(
        (day.getTime() - start.getTime()) / 86_400_000,
      );
      dayNumber = ((diffDays % maxDay) + maxDay) % maxDay + 1;
    } else {
      const jsDay = day.getUTCDay();
      dayNumber = jsDay === 0 ? 7 : jsDay;
    }

    return plan.items.filter((item) => item.dayNumber === dayNumber).length;
  }

  findRecentCheckins(userId: string, days = 60) {
    const end = startOfLocalCalendarDay();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    return this.prisma.dailyCheckin.findMany({
      where: {
        userId,
        checkInDate: { gte: start, lte: end },
      },
      orderBy: { checkInDate: 'desc' },
    });
  }

  async findTodayRawCounts(userId: string, day = startOfLocalCalendarDay()) {
    const { start, end } = dayBoundsUtc(day);
    const [mealLogs, hydrationLogs, workoutSessions, progressLogs] =
      await Promise.all([
        this.prisma.mealLog.count({
          where: {
            userId,
            OR: [
              { consumedAt: { gte: start, lt: end } },
              { consumedAt: null, createdAt: { gte: start, lt: end } },
            ],
          },
        }),
        this.prisma.hydrationLog.count({
          where: { userId, loggedAt: { gte: start, lt: end } },
        }),
        this.prisma.workoutSessionLog.count({
          where: {
            userId,
            OR: [
              { completedAt: { gte: start, lt: end } },
              { completedAt: null, createdAt: { gte: start, lt: end } },
            ],
          },
        }),
        this.prisma.progressLog.count({
          where: { userId, createdAt: { gte: start, lt: end } },
        }),
      ]);

    return { mealLogs, hydrationLogs, workoutSessions, progressLogs };
  }
}
