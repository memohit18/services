export interface NutritionPreferencesView {
  id: string;
  userId: string;
  budgetCategory: string | null;
  preferredCuisine: string | null;
  mealsPerDay: number | null;
  cookingTimeMinutes: number | null;
  preferredMealTiming: string | null;
  createdAt: Date;
  updatedAt: Date;
}
