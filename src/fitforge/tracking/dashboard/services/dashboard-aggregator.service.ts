import { Injectable } from '@nestjs/common';
import type { DailyCheckin } from '@prisma/client';
import {
  startOfLocalCalendarDay,
} from '../../checkins/aggregator/daily-aggregator.engine';
import { DailyAggregatorService } from '../../checkins/services/daily-aggregator.service';
import { ComplianceService } from '../../compliance/services/compliance.service';
import { WATER_TARGET_ML } from '../engines/score.engine';
import { DashboardRepository } from '../repositories/dashboard.repository';

export type DashboardTargets = {
  calorieTarget: number;
  proteinTarget: number;
  mealsAssigned: number;
  waterTargetMl: number;
  transformationId: string | null;
  dietPlanId: string | null;
};

/**
 * Aggregates existing DailyCheckin + targets into dashboard payloads.
 * Does not create tables — rebuilds from meal/workout/hydration/progress events.
 */
@Injectable()
export class AggregatorService {
  constructor(
    private readonly dailyAggregator: DailyAggregatorService,
    private readonly dashboardRepository: DashboardRepository,
    private readonly complianceService: ComplianceService,
  ) {}

  async rebuildToday(userId: string) {
    return this.dailyAggregator.rebuildForDate(
      userId,
      startOfLocalCalendarDay(),
    );
  }

  async resolveTargets(userId: string, checkin: DailyCheckin): Promise<DashboardTargets> {
    const [transformation, diet, assignedMeals] = await Promise.all([
      this.dashboardRepository.findActiveTransformationTargets(userId),
      this.dashboardRepository.findActiveDietTargets(userId),
      this.dashboardRepository.countAssignedMealsToday(userId),
    ]);

    const calorieTarget =
      diet?.caloriesTarget ??
      transformation?.dailyCalorieTarget ??
      0;
    const proteinTarget =
      diet?.proteinTarget ?? transformation?.proteinTarget ?? 0;
    const mealsAssigned = Math.max(
      assignedMeals,
      checkin.mealsCompleted + checkin.mealsSkipped,
    );

    return {
      calorieTarget,
      proteinTarget,
      mealsAssigned,
      waterTargetMl: WATER_TARGET_ML,
      transformationId: transformation?.id ?? null,
      dietPlanId: diet?.id ?? checkin.dietPlanId ?? null,
    };
  }

  async buildTodayContext(userId: string) {
    const checkin = await this.rebuildToday(userId);
    const targets = await this.resolveTargets(userId, checkin);
    const scored = this.complianceService.scoreCheckin(checkin, targets);
    const compliance = this.complianceService.complianceForCheckin(
      checkin,
      targets,
    );
    const date = checkin.checkInDate.toISOString().slice(0, 10);
    const recent = await this.dashboardRepository.findRecentCheckins(userId, 60);
    const targetsByDate = new Map(
      recent.map((c) => {
        const d = c.checkInDate.toISOString().slice(0, 10);
        // Historical days use logged assigned meals; today uses live plan count.
        const mealsAssigned =
          d === date
            ? targets.mealsAssigned
            : c.mealsCompleted + c.mealsSkipped;
        return [
          d,
          {
            calorieTarget: targets.calorieTarget,
            proteinTarget: targets.proteinTarget,
            mealsAssigned,
          },
        ] as const;
      }),
    );
    // Ensure today is present even if rebuild created a fresh row mid-request.
    targetsByDate.set(date, {
      calorieTarget: targets.calorieTarget,
      proteinTarget: targets.proteinTarget,
      mealsAssigned: targets.mealsAssigned,
    });

    const streak = this.complianceService.streakFromCheckins(
      recent,
      targetsByDate,
      date,
    );
    const achievements = this.complianceService.achievements({
      todayScore: scored.todayScore,
      streak,
      workoutCompleted: checkin.workoutCompleted,
      mealsCompleted: checkin.mealsCompleted,
      mealsAssigned: targets.mealsAssigned,
      waterPercent: scored.breakdown.water,
      checkins: recent,
      targetsByDate,
      today: date,
    });

    const rawCounts = await this.dashboardRepository.findTodayRawCounts(userId);

    return {
      date,
      checkin,
      targets,
      scored,
      compliance,
      streak,
      achievements,
      rawCounts,
    };
  }
}
