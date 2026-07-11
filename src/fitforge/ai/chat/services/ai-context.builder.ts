import { Injectable } from '@nestjs/common';
import type {
  AiMessage,
  DailyCheckin,
  DietPlan,
  ProgressLog,
  TransformationTarget,
  User,
  UserFitnessProfile,
  UserFoodPreference,
  UserNutritionPreference,
  WorkoutPlan,
} from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { startOfLocalCalendarDay } from '../../../tracking/checkins/aggregator/daily-aggregator.engine';
import {
  computeStreak,
  type StreakResult,
} from '../../../tracking/compliance/engines/compliance.engine';
import {
  computeDayScore,
  WATER_TARGET_ML,
  type DayScoreResult,
} from '../../../tracking/dashboard/engines/score.engine';

export const COACH_CONTEXT_VERSION = 'coach-v3';

const workoutPlanInclude = {
  days: {
    orderBy: { dayNumber: 'asc' as const },
    include: {
      exercises: {
        include: { exercise: true },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
};

export type WorkoutPlanWithDays = WorkoutPlan & {
  days: Array<{
    dayNumber: number;
    title: string;
    exercises: Array<{
      sets: number;
      reps: string;
      restSeconds: number;
      exercise: { name: string };
    }>;
  }>;
};

export type TodayMealSnapshot = {
  mealType: string;
  foodName: string;
  status: string;
  calories: number;
  protein: number;
};

export type WorkoutProgressSnapshot = {
  sessionId: string | null;
  status: string | null;
  dayTitle: string | null;
  exercisesPlanned: number;
  exercisesCompleted: number;
  exercisesSkipped: number;
  setsLogged: number;
  workoutCompletedToday: boolean;
};

export type CoachContext = {
  contextVersion: string;
  user: Pick<User, 'name'>;
  profile: UserFitnessProfile | null;
  transformation: TransformationTarget | null;
  nutritionPreference: UserNutritionPreference | null;
  activeDiet: DietPlan | null;
  activeWorkout: WorkoutPlanWithDays | null;
  todayMeals: TodayMealSnapshot[];
  todayWaterMl: number;
  workoutProgress: WorkoutProgressSnapshot;
  latestProgress: ProgressLog | null;
  recentProgress: ProgressLog[];
  latestCheckin: DailyCheckin | null;
  recentCheckins: DailyCheckin[];
  foodPreferences: UserFoodPreference[];
  /** Overall Phase 8.2 score (0–100) */
  compliancePercent: number | null;
  dayScore: DayScoreResult | null;
  streak: StreakResult | null;
};

/**
 * AIContextBuilder — loads coach context from DB.
 * The LLM never receives Prisma or queries the database itself.
 */
@Injectable()
export class AIContextBuilder {
  constructor(private readonly prisma: PrismaService) {}

  getContextVersion() {
    return COACH_CONTEXT_VERSION;
  }

  async build(userId: string): Promise<CoachContext> {
    const dayStart = startOfLocalCalendarDay();
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const [
      user,
      profile,
      transformation,
      nutritionPreference,
      activeDiet,
      activeWorkout,
      latestProgress,
      recentProgress,
      latestCheckin,
      recentCheckins,
      foodPreferences,
      todayMealLogs,
      hydrationSum,
      workoutProgress,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }),
      this.prisma.userFitnessProfile.findUnique({ where: { userId } }),
      this.prisma.transformationTarget.findFirst({
        where: { userId, status: 'active' },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userNutritionPreference.findUnique({ where: { userId } }),
      this.prisma.dietPlan.findFirst({
        where: { userId, status: 'active' },
        orderBy: { version: 'desc' },
      }),
      this.prisma.workoutPlan.findFirst({
        where: { userId, status: 'active' },
        orderBy: { version: 'desc' },
        include: workoutPlanInclude,
      }),
      this.prisma.progressLog.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.progressLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 14,
      }),
      this.prisma.dailyCheckin.findFirst({
        where: { userId, checkInDate: dayStart },
      }),
      this.prisma.dailyCheckin.findMany({
        where: { userId },
        orderBy: { checkInDate: 'desc' },
        take: 60,
      }),
      this.prisma.userFoodPreference.findMany({ where: { userId } }),
      this.prisma.mealLog.findMany({
        where: {
          userId,
          OR: [
            { consumedAt: { gte: dayStart, lt: dayEnd } },
            { consumedAt: null, createdAt: { gte: dayStart, lt: dayEnd } },
          ],
        },
        include: {
          mealPlanItem: { include: { food: true } },
          replacementFood: true,
        },
        take: 20,
      }),
      this.sumHydration(userId, dayStart, dayEnd),
      this.buildWorkoutProgress(userId, dayStart, dayEnd),
    ]);

    const todayMeals: TodayMealSnapshot[] = todayMealLogs.map((log) => ({
      mealType: log.mealPlanItem?.mealType ?? 'unknown',
      foodName:
        log.replacementFood?.name ??
        log.mealPlanItem?.food.name ??
        'Unknown food',
      status: log.status,
      calories: log.actualCalories ?? log.mealPlanItem?.calories ?? 0,
      protein: log.actualProtein ?? log.mealPlanItem?.protein ?? 0,
    }));

    const calorieTarget =
      activeDiet?.caloriesTarget ??
      transformation?.dailyCalorieTarget ??
      0;
    const proteinTarget =
      activeDiet?.proteinTarget ?? transformation?.proteinTarget ?? 0;

    const mealsCompleted =
      latestCheckin?.mealsCompleted ??
      todayMeals.filter((m) =>
        ['completed', 'replaced', 'partial'].includes(m.status),
      ).length;
    const mealsSkipped =
      latestCheckin?.mealsSkipped ??
      todayMeals.filter((m) => m.status === 'skipped').length;
    const mealsAssigned = Math.max(
      mealsCompleted + mealsSkipped,
      todayMeals.length,
    );

    const dayScore = computeDayScore({
      mealsCompleted,
      mealsAssigned,
      workoutCompleted:
        latestCheckin?.workoutCompleted ??
        workoutProgress.workoutCompletedToday,
      caloriesConsumed:
        latestCheckin?.caloriesConsumed ??
        todayMeals
          .filter((m) =>
            ['completed', 'replaced', 'partial'].includes(m.status),
          )
          .reduce((s, m) => s + m.calories, 0),
      calorieTarget,
      proteinConsumed:
        latestCheckin?.proteinConsumed ??
        todayMeals
          .filter((m) =>
            ['completed', 'replaced', 'partial'].includes(m.status),
          )
          .reduce((s, m) => s + m.protein, 0),
      proteinTarget,
      waterMl: latestCheckin?.waterIntakeMl ?? hydrationSum,
      waterTargetMl: WATER_TARGET_ML,
    });

    const today = dayStart.toISOString().slice(0, 10);
    const streakDays = recentCheckins.map((c) => {
      const date = c.checkInDate.toISOString().slice(0, 10);
      const assigned = Math.max(c.mealsCompleted + c.mealsSkipped, 0);
      const score = computeDayScore({
        mealsCompleted: c.mealsCompleted,
        mealsAssigned: assigned,
        workoutCompleted: c.workoutCompleted,
        caloriesConsumed: c.caloriesConsumed ?? 0,
        calorieTarget,
        proteinConsumed: c.proteinConsumed ?? 0,
        proteinTarget,
        waterMl: c.waterIntakeMl ?? 0,
        waterTargetMl: WATER_TARGET_ML,
      }).todayScore;
      return { date, score };
    });
    // Ensure today is represented even without a checkin row yet
    if (!streakDays.some((d) => d.date === today)) {
      streakDays.unshift({ date: today, score: dayScore.todayScore });
    }
    const streak = computeStreak(streakDays, today);

    return {
      contextVersion: COACH_CONTEXT_VERSION,
      user: user ?? { name: 'User' },
      profile,
      transformation,
      nutritionPreference,
      activeDiet,
      activeWorkout: activeWorkout as WorkoutPlanWithDays | null,
      todayMeals,
      todayWaterMl: hydrationSum,
      workoutProgress,
      latestProgress,
      recentProgress,
      latestCheckin,
      recentCheckins,
      foodPreferences,
      compliancePercent: dayScore.todayScore,
      dayScore,
      streak,
    };
  }

  private async buildWorkoutProgress(
    userId: string,
    dayStart: Date,
    dayEnd: Date,
  ): Promise<WorkoutProgressSnapshot> {
    try {
      const sessions = await this.prisma.workoutSessionLog.findMany({
        where: {
          userId,
          OR: [
            { completedAt: { gte: dayStart, lt: dayEnd } },
            { completedAt: null, createdAt: { gte: dayStart, lt: dayEnd } },
            { status: { in: ['in_progress', 'paused', 'partial'] } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          workoutPlanDay: { select: { title: true } },
          exerciseLogs: {
            select: { status: true, setNumber: true },
          },
        },
      });

      const active =
        sessions.find((s) =>
          ['in_progress', 'paused', 'partial'].includes(s.status),
        ) ?? sessions[0] ?? null;

      const logs = active?.exerciseLogs ?? [];
      const exercisesCompleted = logs.filter(
        (l) => l.status === 'completed' && l.setNumber == null,
      ).length;
      const exercisesSkipped = logs.filter(
        (l) => l.status === 'skipped',
      ).length;
      const setsLogged = logs.filter((l) => l.setNumber != null).length;

      const planned = active?.workoutPlanDayId
          ? await this.prisma.workoutExercise.count({
              where: { workoutDayId: active.workoutPlanDayId },
            })
          : 0;

      return {
        sessionId: active?.id ?? null,
        status: active?.status ?? null,
        dayTitle: active?.workoutPlanDay?.title ?? null,
        exercisesPlanned: planned,
        exercisesCompleted,
        exercisesSkipped,
        setsLogged,
        workoutCompletedToday: sessions.some(
          (s) => s.status === 'completed' || s.status === 'partial',
        ),
      };
    } catch {
      return {
        sessionId: null,
        status: null,
        dayTitle: null,
        exercisesPlanned: 0,
        exercisesCompleted: 0,
        exercisesSkipped: 0,
        setsLogged: 0,
        workoutCompletedToday: false,
      };
    }
  }

  private async sumHydration(userId: string, dayStart: Date, dayEnd: Date) {
    try {
      const hydrationSum = await this.prisma.hydrationLog.aggregate({
        where: { userId, loggedAt: { gte: dayStart, lt: dayEnd } },
        _sum: { amountMl: true },
      });
      return hydrationSum._sum.amountMl ?? 0;
    } catch {
      return 0;
    }
  }

  /** @deprecated use build() */
  async buildCoachContext(userId: string): Promise<CoachContext> {
    return this.build(userId);
  }

  formatHistory(messages: AiMessage[]): string {
    if (messages.length === 0) {
      return 'No prior messages.';
    }
    return messages
      .map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
      .join('\n');
  }
}
