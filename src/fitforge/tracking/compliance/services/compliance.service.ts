import { Injectable } from '@nestjs/common';
import type { DailyCheckin } from '@prisma/client';
import {
  computeDayScore,
  WATER_TARGET_ML,
} from '../../dashboard/engines/score.engine';
import {
  computeComplianceBreakdown,
  computeStreak,
  deriveAchievements,
  isCompliantDay,
  type Achievement,
  type ComplianceBreakdown,
  type StreakResult,
} from '../engines/compliance.engine';
import { ComplianceRepository } from '../repositories/compliance.repository';

@Injectable()
export class ComplianceService {
  constructor(private readonly complianceRepository: ComplianceRepository) {}

  findRecentCheckins(userId: string, days = 60) {
    return this.complianceRepository.findRecent(userId, days);
  }

  buildScoreInputFromCheckin(
    checkin: DailyCheckin,
    targets: {
      calorieTarget: number;
      proteinTarget: number;
      mealsAssigned: number;
      waterTargetMl?: number;
    },
  ) {
    const mealsAssigned = Math.max(
      targets.mealsAssigned,
      checkin.mealsCompleted + checkin.mealsSkipped,
    );
    return {
      mealsCompleted: checkin.mealsCompleted,
      mealsAssigned,
      workoutCompleted: checkin.workoutCompleted,
      caloriesConsumed: checkin.caloriesConsumed ?? 0,
      calorieTarget: targets.calorieTarget,
      proteinConsumed: checkin.proteinConsumed ?? 0,
      proteinTarget: targets.proteinTarget,
      waterMl: checkin.waterIntakeMl ?? 0,
      waterTargetMl: targets.waterTargetMl ?? WATER_TARGET_ML,
      dietCompliance: checkin.dietCompliance,
    };
  }

  scoreCheckin(
    checkin: DailyCheckin,
    targets: {
      calorieTarget: number;
      proteinTarget: number;
      mealsAssigned: number;
      waterTargetMl?: number;
    },
  ) {
    return computeDayScore(this.buildScoreInputFromCheckin(checkin, targets));
  }

  complianceForCheckin(
    checkin: DailyCheckin,
    targets: {
      calorieTarget: number;
      proteinTarget: number;
      mealsAssigned: number;
      waterTargetMl?: number;
    },
  ): ComplianceBreakdown {
    return computeComplianceBreakdown(
      this.buildScoreInputFromCheckin(checkin, targets),
    );
  }

  streakFromCheckins(
    checkins: DailyCheckin[],
    targetsByDate: Map<
      string,
      { calorieTarget: number; proteinTarget: number; mealsAssigned: number }
    >,
    today: string,
  ): StreakResult {
    const days = checkins.map((c) => {
      const date = c.checkInDate.toISOString().slice(0, 10);
      const targets = targetsByDate.get(date) ?? {
        calorieTarget: 0,
        proteinTarget: 0,
        mealsAssigned: c.mealsCompleted + c.mealsSkipped,
      };
      const score = this.scoreCheckin(c, targets).todayScore;
      return { date, score };
    });
    return computeStreak(days, today);
  }

  achievements(input: {
    todayScore: number;
    streak: StreakResult;
    workoutCompleted: boolean;
    mealsCompleted: number;
    mealsAssigned: number;
    waterPercent: number;
    checkins: DailyCheckin[];
    targetsByDate: Map<
      string,
      { calorieTarget: number; proteinTarget: number; mealsAssigned: number }
    >;
    today: string;
  }): Achievement[] {
    const totalCompliantDays = input.checkins.filter((c) => {
      const date = c.checkInDate.toISOString().slice(0, 10);
      const targets = input.targetsByDate.get(date) ?? {
        calorieTarget: 0,
        proteinTarget: 0,
        mealsAssigned: c.mealsCompleted + c.mealsSkipped,
      };
      return isCompliantDay(this.scoreCheckin(c, targets).todayScore);
    }).length;

    return deriveAchievements({
      todayScore: input.todayScore,
      currentStreak: input.streak.currentStreak,
      longestStreak: input.streak.longestStreak,
      workoutCompleted: input.workoutCompleted,
      mealsCompleted: input.mealsCompleted,
      mealsAssigned: input.mealsAssigned,
      waterPercent: input.waterPercent,
      totalCompliantDays,
      today: input.today,
    });
  }
}
