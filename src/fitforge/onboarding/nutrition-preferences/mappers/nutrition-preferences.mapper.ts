import type { UserNutritionPreference } from '@prisma/client';
import type { NutritionPreferencesView } from '../interfaces/nutrition-preferences.interface';

export function toNutritionPreferencesView(
  model: UserNutritionPreference,
): NutritionPreferencesView {
  return {
    id: model.id,
    userId: model.userId,
    budgetCategory: model.budgetCategory,
    preferredCuisine: model.preferredCuisine,
    mealsPerDay: model.mealsPerDay,
    cookingTimeMinutes: model.cookingTimeMinutes,
    preferredMealTiming: model.preferredMealTiming,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
  };
}
