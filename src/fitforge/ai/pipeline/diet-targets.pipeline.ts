import type {
  AiRemainingMacros,
  MealDistribution,
  MealMacroSplit,
} from '../shared/diet-targets.types';
import {
  assertNumber,
  assertObject,
} from './json-assert';

const MEAL_KEYS = ['breakfast', 'lunch', 'snack', 'dinner'] as const;

function validateMealSplit(raw: unknown, meal: string): MealMacroSplit {
  const obj = assertObject(raw, `mealDistribution.${meal}`);
  return {
    caloriesPercent: assertNumber(obj.caloriesPercent, `${meal}.caloriesPercent`, {
      min: 0,
      max: 100,
    }),
    proteinPercent: assertNumber(obj.proteinPercent, `${meal}.proteinPercent`, {
      min: 0,
      max: 100,
    }),
    carbsPercent: assertNumber(obj.carbsPercent, `${meal}.carbsPercent`, {
      min: 0,
      max: 100,
    }),
    fatsPercent: assertNumber(obj.fatsPercent, `${meal}.fatsPercent`, {
      min: 0,
      max: 100,
    }),
  };
}

export function validateDietTargetsResponse(raw: unknown): AiRemainingMacros {
  const obj = assertObject(raw, 'Diet targets response');
  const distributionRaw = assertObject(
    obj.mealDistribution,
    'mealDistribution',
  );

  const mealDistribution = {} as MealDistribution;
  for (const meal of MEAL_KEYS) {
    mealDistribution[meal] = validateMealSplit(distributionRaw[meal], meal);
  }

  return {
    carbs: assertNumber(obj.carbs, 'carbs', { min: 0 }),
    fats: assertNumber(obj.fats, 'fats', { min: 0 }),
    mealDistribution,
  };
}

export type NormalizedDietTargets = {
  carbs: number;
  fats: number;
  mealDistribution: MealDistribution;
};

/**
 * Round macros and lightly rebalance meal calorie percents toward 100%.
 */
export function normalizeDietTargets(
  raw: AiRemainingMacros,
  engine: { dailyCalories: number; proteinTarget: number },
): NormalizedDietTargets {
  const proteinKcal = engine.proteinTarget * 4;
  const remainingKcal = Math.max(0, engine.dailyCalories - proteinKcal);

  let carbs = Math.round(raw.carbs);
  let fats = Math.round(raw.fats);

  const usedKcal = carbs * 4 + fats * 9;
  if (remainingKcal > 0 && usedKcal > 0) {
    const scale = remainingKcal / usedKcal;
    // Only rescale when AI is wildly off (>25% drift)
    if (scale < 0.75 || scale > 1.25) {
      carbs = Math.max(0, Math.round(carbs * scale));
      fats = Math.max(0, Math.round(fats * scale));
    }
  }

  const mealDistribution = { ...raw.mealDistribution } as MealDistribution;
  const calorieSum = MEAL_KEYS.reduce(
    (sum, meal) => sum + mealDistribution[meal].caloriesPercent,
    0,
  );

  if (calorieSum > 0 && Math.abs(calorieSum - 100) > 5) {
    for (const meal of MEAL_KEYS) {
      const split = mealDistribution[meal];
      mealDistribution[meal] = {
        ...split,
        caloriesPercent: Math.round((split.caloriesPercent / calorieSum) * 1000) / 10,
      };
    }
  }

  return { carbs, fats, mealDistribution };
}
