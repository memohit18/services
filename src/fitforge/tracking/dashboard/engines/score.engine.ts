export const SCORE_WEIGHTS = {
  meals: 0.3,
  workout: 0.3,
  calories: 0.15,
  protein: 0.15,
  water: 0.1,
} as const;

export const WATER_TARGET_ML = 4000;
export const COMPLIANT_DAY_MIN_SCORE = 60;

export type DayScoreInput = {
  mealsCompleted: number;
  mealsAssigned: number;
  workoutCompleted: boolean;
  caloriesConsumed: number;
  calorieTarget: number;
  proteinConsumed: number;
  proteinTarget: number;
  waterMl: number;
  waterTargetMl?: number;
};

export type DayScoreBreakdown = {
  meals: number;
  workout: number;
  calories: number;
  protein: number;
  water: number;
};

export type DayScoreResult = {
  todayScore: number;
  breakdown: DayScoreBreakdown;
  weights: typeof SCORE_WEIGHTS;
  remainingCalories: number;
  remainingProtein: number;
  calorieTarget: number;
  proteinTarget: number;
  waterTargetMl: number;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.min(100, Math.round(value));
}

/**
 * Phase 8.2 score engine.
 * Meals 30% + Workout 30% + Calories 15% + Protein 15% + Water 10%.
 */
export function computeDayScore(input: DayScoreInput): DayScoreResult {
  const waterTarget = input.waterTargetMl ?? WATER_TARGET_ML;
  const calorieTarget = Math.max(0, input.calorieTarget);
  const proteinTarget = Math.max(0, input.proteinTarget);
  const caloriesConsumed = Math.max(0, input.caloriesConsumed);
  const proteinConsumed = Math.max(0, input.proteinConsumed);
  const waterMl = Math.max(0, input.waterMl);

  const mealsAssigned = Math.max(0, input.mealsAssigned);
  const mealsCompleted = Math.max(0, input.mealsCompleted);

  const meals =
    mealsAssigned > 0
      ? clampPercent((mealsCompleted / mealsAssigned) * 100)
      : 0;
  const workout = input.workoutCompleted ? 100 : 0;
  const calories =
    calorieTarget > 0
      ? clampPercent((caloriesConsumed / calorieTarget) * 100)
      : 0;
  const protein =
    proteinTarget > 0
      ? clampPercent((proteinConsumed / proteinTarget) * 100)
      : 0;
  const water =
    waterTarget > 0 ? clampPercent((waterMl / waterTarget) * 100) : 0;

  const breakdown: DayScoreBreakdown = {
    meals,
    workout,
    calories,
    protein,
    water,
  };

  const todayScore = Math.round(
    breakdown.meals * SCORE_WEIGHTS.meals +
      breakdown.workout * SCORE_WEIGHTS.workout +
      breakdown.calories * SCORE_WEIGHTS.calories +
      breakdown.protein * SCORE_WEIGHTS.protein +
      breakdown.water * SCORE_WEIGHTS.water,
  );

  return {
    todayScore: clampPercent(todayScore),
    breakdown,
    weights: SCORE_WEIGHTS,
    remainingCalories: Math.max(0, Math.round(calorieTarget - caloriesConsumed)),
    remainingProtein: Math.max(0, Math.round(proteinTarget - proteinConsumed)),
    calorieTarget,
    proteinTarget,
    waterTargetMl: waterTarget,
  };
}
