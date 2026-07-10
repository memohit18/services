import type { DailyCheckin } from '@prisma/client';

export type MealLogAggInput = {
  status: string;
  actualCalories: number | null;
  actualProtein: number | null;
};

export type HydrationAggInput = {
  amountMl: number;
};

export type WorkoutSessionAggInput = {
  status: string;
};

export type ProgressAggInput = {
  weightKg: number | null;
  notes: string | null;
};

export type DailyAggregateInput = {
  mealLogs: MealLogAggInput[];
  hydrationLogs: HydrationAggInput[];
  workoutSessions: WorkoutSessionAggInput[];
  progressLogs: ProgressAggInput[];
  dietPlanId: string | null;
  workoutPlanId: string | null;
  existingNotes?: string | null;
};

export type DailyAggregateResult = {
  dietPlanId: string | null;
  workoutPlanId: string | null;
  weightKg: number | null;
  caloriesConsumed: number | null;
  proteinConsumed: number | null;
  waterIntakeMl: number;
  mealsCompleted: number;
  mealsSkipped: number;
  dietCompliance: number;
  workoutCompleted: boolean;
  notes: string | null;
};

/**
 * Pure aggregation: raw day events → DailyCheckin summary fields.
 */
export function aggregateDailyCheckin(
  input: DailyAggregateInput,
): DailyAggregateResult {
  const mealsCompleted = input.mealLogs.filter(
    (l) => l.status === 'completed' || l.status === 'replaced',
  ).length;
  const mealsSkipped = input.mealLogs.filter(
    (l) => l.status === 'skipped',
  ).length;
  const mealsAssigned = mealsCompleted + mealsSkipped;
  const dietCompliance =
    mealsAssigned > 0
      ? Math.round((mealsCompleted / mealsAssigned) * 100)
      : 0;

  const caloriesFromMeals = input.mealLogs
    .filter((l) => l.status === 'completed' || l.status === 'replaced')
    .reduce((sum, l) => sum + (l.actualCalories ?? 0), 0);
  const proteinFromMeals = input.mealLogs
    .filter((l) => l.status === 'completed' || l.status === 'replaced')
    .reduce((sum, l) => sum + (l.actualProtein ?? 0), 0);

  const waterIntakeMl = input.hydrationLogs.reduce(
    (sum, l) => sum + l.amountMl,
    0,
  );

  const workoutCompleted = input.workoutSessions.some(
    (s) => s.status === 'completed' || s.status === 'partial',
  );

  const latestProgress = input.progressLogs[0] ?? null;

  return {
    dietPlanId: input.dietPlanId,
    workoutPlanId: input.workoutPlanId,
    weightKg: latestProgress?.weightKg ?? null,
    caloriesConsumed: mealsAssigned > 0 ? Math.round(caloriesFromMeals) : null,
    proteinConsumed: mealsAssigned > 0 ? Math.round(proteinFromMeals) : null,
    waterIntakeMl,
    mealsCompleted,
    mealsSkipped,
    dietCompliance,
    workoutCompleted,
    notes: latestProgress?.notes ?? input.existingNotes ?? null,
  };
}

export function dayBoundsUtc(day: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** Local calendar day as UTC midnight (matches diet planner / meal tracking). */
export function startOfLocalCalendarDay(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

export type CheckinSummarySlice = Pick<
  DailyCheckin,
  | 'waterIntakeMl'
  | 'mealsCompleted'
  | 'mealsSkipped'
  | 'dietCompliance'
  | 'workoutCompleted'
  | 'caloriesConsumed'
  | 'proteinConsumed'
  | 'weightKg'
>;
