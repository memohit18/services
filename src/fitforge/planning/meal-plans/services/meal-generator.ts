import type { FoodMaster } from '@prisma/client';
import { MEAL_TYPES } from '../../../../../db-schema/postgres/constants/fitforge-values';
import type { MealDistribution } from '../../../ai/shared/diet-targets.types';

export type MacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type MealSlot = (typeof MEAL_TYPES)[number];

const DEFAULT_MEAL_SPLITS: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  snack: 0.1,
  dinner: 0.3,
};

function mealTargetsForSlot(
  dailyTargets: MacroTargets,
  mealType: MealSlot,
  mealDistribution?: MealDistribution | null,
): MacroTargets {
  const split = mealDistribution?.[mealType];
  if (split) {
    return {
      calories: Math.round(dailyTargets.calories * (split.caloriesPercent / 100)),
      protein: Math.round(dailyTargets.protein * (split.proteinPercent / 100)),
      carbs: Math.round(dailyTargets.carbs * (split.carbsPercent / 100)),
      fats: Math.round(dailyTargets.fats * (split.fatsPercent / 100)),
    };
  }

  const defaultSplit = DEFAULT_MEAL_SPLITS[mealType];
  return {
    calories: Math.round(dailyTargets.calories * defaultSplit),
    protein: Math.round(dailyTargets.protein * defaultSplit),
    carbs: Math.round(dailyTargets.carbs * defaultSplit),
    fats: Math.round(dailyTargets.fats * defaultSplit),
  };
}

export type GeneratedMealItem = {
  dayNumber: number;
  mealType: MealSlot;
  foodId: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

function scaleMacros(food: FoodMaster, quantity: number) {
  return {
    calories: Math.round(food.calories * quantity),
    protein: Math.round(food.protein * quantity * 10) / 10,
    carbs: Math.round(food.carbs * quantity * 10) / 10,
    fats: Math.round(food.fats * quantity * 10) / 10,
  };
}

function macroDistance(food: FoodMaster, targets: MacroTargets) {
  const calDiff = Math.abs(food.calories - targets.calories);
  const proteinDiff = Math.abs(food.protein - targets.protein) * 4;
  return calDiff + proteinDiff;
}

function pickFoodsForMeal(
  pool: FoodMaster[],
  favorites: Set<string>,
  targets: MacroTargets,
): GeneratedMealItem[] {
  const ranked = [...pool].sort((a, b) => {
    const favA = favorites.has(a.id) ? 0 : 1;
    const favB = favorites.has(b.id) ? 0 : 1;
    if (favA !== favB) {
      return favA - favB;
    }
    return macroDistance(a, targets) - macroDistance(b, targets);
  });

  const items: GeneratedMealItem[] = [];
  let remaining = { ...targets };

  for (const food of ranked) {
    if (remaining.calories <= 0) {
      break;
    }
    if (items.length >= 2) {
      break;
    }

    const quantity =
      food.calories > 0
        ? Math.min(2, Math.max(0.5, remaining.calories / food.calories))
        : 1;
    const macros = scaleMacros(food, quantity);

    items.push({
      dayNumber: 0,
      mealType: 'breakfast',
      foodId: food.id,
      quantity: Math.round(quantity * 100) / 100,
      ...macros,
    });

    remaining = {
      calories: remaining.calories - macros.calories,
      protein: remaining.protein - macros.protein,
      carbs: remaining.carbs - macros.carbs,
      fats: remaining.fats - macros.fats,
    };
  }

  return items;
}

export function buildDailyMealItems(
  foods: FoodMaster[],
  favorites: Set<string>,
  dailyTargets: MacroTargets,
  dayNumber: number,
  mealDistribution?: MealDistribution | null,
): GeneratedMealItem[] {
  if (foods.length === 0) {
    return [];
  }

  const items: GeneratedMealItem[] = [];

  for (const mealType of MEAL_TYPES) {
    const mealTargets = mealTargetsForSlot(dailyTargets, mealType, mealDistribution);

    const mealItems = pickFoodsForMeal(foods, favorites, mealTargets);
    for (const item of mealItems) {
      items.push({ ...item, dayNumber, mealType });
    }
  }

  return items;
}
