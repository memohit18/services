import { Injectable } from '@nestjs/common';
import { getPagination, PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { paginatedResponse, successResponse } from '../../../../common/utils/api-response';
import { startOfLocalCalendarDay } from '../aggregator/daily-aggregator.engine';
import { CreateCheckinDto } from '../dto/create-checkin.dto';
import { DailyCheckinRepository } from '../repositories/daily-checkin.repository';
import { DailyAggregatorService } from './daily-aggregator.service';

@Injectable()
export class CheckinsService {
  constructor(
    private readonly dailyCheckinRepository: DailyCheckinRepository,
    private readonly dailyAggregator: DailyAggregatorService,
  ) {}

  /**
   * Rebuild today's DailyCheckin from raw events, then apply optional
   * legacy field overrides (for older clients that POST absolute values).
   * Prefer POST /checkins/hydration and /checkins/workout-sessions for new clients.
   */
  async checkin(userId: string, dto: CreateCheckinDto) {
    let checkin = await this.dailyAggregator.rebuildForDate(
      userId,
      startOfLocalCalendarDay(),
    );

    const hasLegacyOverrides =
      dto.weightKg !== undefined ||
      dto.caloriesConsumed !== undefined ||
      dto.proteinConsumed !== undefined ||
      dto.waterIntakeMl !== undefined ||
      dto.mealsCompleted !== undefined ||
      dto.mealsSkipped !== undefined ||
      dto.workoutCompleted !== undefined ||
      dto.notes !== undefined;

    if (!hasLegacyOverrides) {
      return checkin;
    }

    const mealsCompleted = dto.mealsCompleted ?? checkin.mealsCompleted;
    const mealsSkipped = dto.mealsSkipped ?? checkin.mealsSkipped;
    const mealsAssigned = mealsCompleted + mealsSkipped;
    const dietCompliance =
      dto.mealsCompleted !== undefined || dto.mealsSkipped !== undefined
        ? mealsAssigned > 0
          ? Math.round((mealsCompleted / mealsAssigned) * 100)
          : 0
        : checkin.dietCompliance;

    return this.dailyCheckinRepository.upsert(userId, checkin.checkInDate, {
      dietPlanId: checkin.dietPlanId,
      workoutPlanId: checkin.workoutPlanId,
      weightKg: dto.weightKg ?? checkin.weightKg,
      caloriesConsumed: dto.caloriesConsumed ?? checkin.caloriesConsumed,
      proteinConsumed: dto.proteinConsumed ?? checkin.proteinConsumed,
      waterIntakeMl: dto.waterIntakeMl ?? checkin.waterIntakeMl,
      mealsCompleted,
      mealsSkipped,
      dietCompliance,
      workoutCompleted: dto.workoutCompleted ?? checkin.workoutCompleted,
      notes: dto.notes ?? checkin.notes,
      aggregatedAt: checkin.aggregatedAt,
    });
  }

  async refreshToday(userId: string) {
    return this.dailyAggregator.rebuildForDate(
      userId,
      startOfLocalCalendarDay(),
    );
  }

  /**
   * Today's score card — rebuilds from events then returns dashboard metrics.
   */
  async getTodayScore(userId: string) {
    const checkin = await this.dailyAggregator.rebuildForDate(
      userId,
      startOfLocalCalendarDay(),
    );

    const mealsAssigned = checkin.mealsCompleted + checkin.mealsSkipped;
    const mealScore =
      mealsAssigned > 0
        ? Math.round((checkin.mealsCompleted / mealsAssigned) * 100)
        : 0;
    const workoutScore = checkin.workoutCompleted ? 100 : 0;
    const waterTarget = 4000;
    const waterScore = Math.min(
      100,
      Math.round(((checkin.waterIntakeMl ?? 0) / waterTarget) * 100),
    );
    const todayScore = Math.round(
      mealScore * 0.45 + workoutScore * 0.35 + waterScore * 0.2,
    );

    return {
      date: checkin.checkInDate.toISOString().slice(0, 10),
      todayScore,
      calories: checkin.caloriesConsumed ?? 0,
      protein: checkin.proteinConsumed ?? 0,
      meals: {
        completed: checkin.mealsCompleted,
        skipped: checkin.mealsSkipped,
        assigned: mealsAssigned,
      },
      workout: {
        completed: checkin.workoutCompleted,
        score: workoutScore,
      },
      water: {
        currentMl: checkin.waterIntakeMl ?? 0,
        targetMl: waterTarget,
        percent: waterScore,
      },
      compliance: checkin.dietCompliance ?? mealScore,
      checkin,
    };
  }

  async findAll(userId: string, query: PaginationQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const [items, total] = await Promise.all([
      this.dailyCheckinRepository.findMany(userId, { skip, take: limit }),
      this.dailyCheckinRepository.count(userId),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async getMonthlyStats(userId: string) {
    const now = new Date();
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const end = new Date(
      Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    );

    const checkins = await this.dailyCheckinRepository.findInRange(
      userId,
      start,
      end,
    );

    const totalDays = checkins.length;
    const avgCompliance =
      totalDays > 0
        ? Math.round(
            checkins.reduce((sum, c) => sum + (c.dietCompliance ?? 0), 0) /
              totalDays,
          )
        : 0;
    const workoutsCompleted = checkins.filter((c) => c.workoutCompleted).length;

    return successResponse({
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      totalCheckins: totalDays,
      avgDietCompliance: avgCompliance,
      workoutsCompleted,
      avgCalories:
        totalDays > 0
          ? Math.round(
              checkins.reduce((sum, c) => sum + (c.caloriesConsumed ?? 0), 0) /
                totalDays,
            )
          : 0,
      avgProtein:
        totalDays > 0
          ? Math.round(
              checkins.reduce((sum, c) => sum + (c.proteinConsumed ?? 0), 0) /
                totalDays,
            )
          : 0,
    }).data;
  }
}
