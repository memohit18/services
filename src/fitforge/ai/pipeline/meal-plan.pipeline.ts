import { BadRequestException } from '@nestjs/common';
import { MEAL_TYPES } from '../../../../db-schema/postgres/constants/fitforge-values';
import {
  assertNonEmptyArray,
  assertNumber,
  assertObject,
  assertString,
  optionalString,
} from './json-assert';

export type AiMealDay = {
  day: number;
  breakfast?: string;
  lunch?: string;
  snack?: string;
  dinner?: string;
};

export type AiMealPlanResponse = {
  days: AiMealDay[];
};

export type NormalizedMealItem = {
  dayNumber: number;
  mealType: (typeof MEAL_TYPES)[number];
  foodName: string;
};

export function validateMealPlanResponse(raw: unknown): AiMealPlanResponse {
  const obj = assertObject(raw, 'Meal plan response');
  const daysRaw = assertNonEmptyArray(obj.days, 'days');

  const days: AiMealDay[] = daysRaw.map((dayRaw, index) => {
    const day = assertObject(dayRaw, `days[${index}]`);
    return {
      day: assertNumber(day.day, `days[${index}].day`, {
        min: 1,
        integer: true,
      }),
      breakfast: optionalString(day.breakfast),
      lunch: optionalString(day.lunch),
      snack: optionalString(day.snack),
      dinner: optionalString(day.dinner),
    };
  });

  const hasAnyMeal = days.some((day) =>
    MEAL_TYPES.some((mealType) => Boolean(day[mealType])),
  );
  if (!hasAnyMeal) {
    throw new BadRequestException('Meal plan must include at least one meal name');
  }

  return { days };
}

export function normalizeMealPlanItems(
  raw: AiMealPlanResponse,
): NormalizedMealItem[] {
  const items: NormalizedMealItem[] = [];

  for (const day of raw.days) {
    for (const mealType of MEAL_TYPES) {
      const foodName = day[mealType];
      if (!foodName) {
        continue;
      }
      items.push({
        dayNumber: day.day,
        mealType,
        foodName: assertString(foodName, `${mealType} food name`, {
          minLength: 1,
        }),
      });
    }
  }

  return items;
}

export type MealPlanPromptInput = {
  days: number;
  caloriesTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatsTarget: number;
  dietType: string;
  goal: string;
  budget: string;
  favorites: string[];
  avoid: string[];
};

export function buildMealPlanPrompt(input: MealPlanPromptInput): string {
  return `Generate a ${input.days}-day Indian meal plan. Return JSON only.

Rules:
- Calories: ${input.caloriesTarget}
- Protein: ${input.proteinTarget}g
- Carbs: ${input.carbsTarget}g
- Fats: ${input.fatsTarget}g
- Diet type: ${input.dietType}
- Goal: ${input.goal}
- Budget: ${input.budget}
- Favorites: ${input.favorites.join(', ') || 'none'}
- Avoid: ${input.avoid.join(', ') || 'none'}

Return format:
{
  "days": [
    {
      "day": 1,
      "breakfast": "Poha",
      "lunch": "Dal Rice",
      "snack": "Fruit",
      "dinner": "Paneer Bhurji"
    }
  ]
}

Use common Indian food names. Include breakfast, lunch, snack, dinner for each day.`;
}
