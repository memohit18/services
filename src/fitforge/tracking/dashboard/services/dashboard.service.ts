import { Injectable } from '@nestjs/common';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { AggregatorService } from './dashboard-aggregator.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly aggregator: AggregatorService,
    private readonly dashboardRepository: DashboardRepository,
  ) {}

  /** Full daily dashboard (today + streak + achievements). */
  async getDashboard(userId: string) {
    const ctx = await this.aggregator.buildTodayContext(userId);
    return this.toDashboardPayload(ctx);
  }

  async getToday(userId: string) {
    const ctx = await this.aggregator.buildTodayContext(userId);
    return {
      date: ctx.date,
      todayScore: ctx.scored.todayScore,
      breakdown: ctx.scored.breakdown,
      weights: ctx.scored.weights,
      meals: {
        completed: ctx.checkin.mealsCompleted,
        skipped: ctx.checkin.mealsSkipped,
        assigned: ctx.targets.mealsAssigned,
        score: ctx.scored.breakdown.meals,
      },
      workout: {
        completed: ctx.checkin.workoutCompleted,
        score: ctx.scored.breakdown.workout,
      },
      water: {
        currentMl: ctx.checkin.waterIntakeMl ?? 0,
        targetMl: ctx.scored.waterTargetMl,
        percent: ctx.scored.breakdown.water,
      },
      calories: ctx.checkin.caloriesConsumed ?? 0,
      protein: ctx.checkin.proteinConsumed ?? 0,
      calorieTarget: ctx.scored.calorieTarget,
      proteinTarget: ctx.scored.proteinTarget,
      remainingCalories: ctx.scored.remainingCalories,
      remainingProtein: ctx.scored.remainingProtein,
      compliance: ctx.compliance.overall,
      checkin: ctx.checkin,
    };
  }

  async getCompliance(userId: string) {
    const ctx = await this.aggregator.buildTodayContext(userId);
    return {
      date: ctx.date,
      compliance: ctx.compliance,
      streak: ctx.streak,
      weights: ctx.scored.weights,
    };
  }

  async getStreak(userId: string) {
    const ctx = await this.aggregator.buildTodayContext(userId);
    return {
      date: ctx.date,
      ...ctx.streak,
      achievements: ctx.achievements.filter((a) => a.unlocked),
    };
  }

  async getSummary(userId: string) {
    const ctx = await this.aggregator.buildTodayContext(userId);
    const weekDates = this.lastNDates(ctx.date, 7);
    const recent = await this.dashboardRepository.findRecentCheckins(userId, 30);
    const week = recent.filter((c) =>
      weekDates.includes(c.checkInDate.toISOString().slice(0, 10)),
    );

    const avg = (values: number[]) =>
      values.length
        ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
        : 0;

    return {
      date: ctx.date,
      today: this.toDashboardPayload(ctx),
      week: {
        daysTracked: week.length,
        workoutsCompleted: week.filter((c) => c.workoutCompleted).length,
        avgDietCompliance: avg(week.map((c) => c.dietCompliance ?? 0)),
        avgCalories: avg(week.map((c) => c.caloriesConsumed ?? 0)),
        avgProtein: avg(week.map((c) => c.proteinConsumed ?? 0)),
        avgWaterMl: avg(week.map((c) => c.waterIntakeMl ?? 0)),
      },
      month: {
        daysTracked: recent.length,
        workoutsCompleted: recent.filter((c) => c.workoutCompleted).length,
        avgDietCompliance: avg(recent.map((c) => c.dietCompliance ?? 0)),
        currentStreak: ctx.streak.currentStreak,
        longestStreak: ctx.streak.longestStreak,
      },
      sources: ctx.rawCounts,
    };
  }

  private toDashboardPayload(
    ctx: Awaited<ReturnType<AggregatorService['buildTodayContext']>>,
  ) {
    return {
      date: ctx.date,
      todayScore: ctx.scored.todayScore,
      breakdown: ctx.scored.breakdown,
      weights: ctx.scored.weights,
      meals: {
        completed: ctx.checkin.mealsCompleted,
        skipped: ctx.checkin.mealsSkipped,
        assigned: ctx.targets.mealsAssigned,
        score: ctx.scored.breakdown.meals,
      },
      workout: {
        completed: ctx.checkin.workoutCompleted,
        score: ctx.scored.breakdown.workout,
      },
      water: {
        currentMl: ctx.checkin.waterIntakeMl ?? 0,
        targetMl: ctx.scored.waterTargetMl,
        percent: ctx.scored.breakdown.water,
      },
      calories: ctx.checkin.caloriesConsumed ?? 0,
      protein: ctx.checkin.proteinConsumed ?? 0,
      calorieTarget: ctx.scored.calorieTarget,
      proteinTarget: ctx.scored.proteinTarget,
      remainingCalories: ctx.scored.remainingCalories,
      remainingProtein: ctx.scored.remainingProtein,
      compliance: ctx.compliance.overall,
      currentStreak: ctx.streak.currentStreak,
      longestStreak: ctx.streak.longestStreak,
      achievements: ctx.achievements,
      checkin: ctx.checkin,
      sources: ctx.rawCounts,
    };
  }

  private lastNDates(today: string, n: number): string[] {
    const out: string[] = [];
    const d = new Date(`${today}T00:00:00.000Z`);
    for (let i = 0; i < n; i += 1) {
      const cur = new Date(d);
      cur.setUTCDate(d.getUTCDate() - i);
      out.push(cur.toISOString().slice(0, 10));
    }
    return out;
  }
}
