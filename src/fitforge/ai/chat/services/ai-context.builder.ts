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

const CONTEXT_VERSION = 'coach-v2';

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
  latestProgress: ProgressLog | null;
  recentProgress: ProgressLog[];
  latestCheckin: DailyCheckin | null;
  recentCheckins: DailyCheckin[];
  foodPreferences: UserFoodPreference[];
  compliancePercent: number | null;
};

/**
 * AIContextBuilder — loads coach context. AI never queries DB itself.
 */
@Injectable()
export class AIContextBuilder {
  constructor(private readonly prisma: PrismaService) {}

  getContextVersion() {
    return CONTEXT_VERSION;
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
        take: 14,
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

    return {
      contextVersion: CONTEXT_VERSION,
      user: user ?? { name: 'User' },
      profile,
      transformation,
      nutritionPreference,
      activeDiet,
      activeWorkout: activeWorkout as WorkoutPlanWithDays | null,
      todayMeals,
      todayWaterMl: hydrationSum,
      latestProgress,
      recentProgress,
      latestCheckin,
      recentCheckins,
      foodPreferences,
      compliancePercent: latestCheckin?.dietCompliance ?? null,
    };
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

  /** @deprecated use build() — kept for AiContextService compatibility */
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
