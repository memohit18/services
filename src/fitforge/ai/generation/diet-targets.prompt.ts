type DietTargetsPromptInput = {
  dailyCalories: number;
  proteinTarget: number;
  fitnessGoal: string;
  dietType: string;
  activityLevel: string;
  budgetPreference: string;
  targetWeightKg?: number | null;
};

export function buildDietTargetsPrompt(input: DietTargetsPromptInput): string {
  return `You are FitForge nutrition AI. Return JSON only.

Transformation Engine Output (fixed — do not recalculate):
Daily Calories: ${input.dailyCalories}
Protein Target: ${input.proteinTarget}g

User context:
Goal: ${input.fitnessGoal}
Diet Type: ${input.dietType}
Activity: ${input.activityLevel}
Budget: ${input.budgetPreference}
Target weight: ${input.targetWeightKg ?? 'n/a'} kg

Generate ONLY the remaining macro split and meal distribution.

Return exactly:
{
  "carbs": number,
  "fats": number,
  "mealDistribution": {
    "breakfast": { "caloriesPercent": number, "proteinPercent": number, "carbsPercent": number, "fatsPercent": number },
    "lunch": { "caloriesPercent": number, "proteinPercent": number, "carbsPercent": number, "fatsPercent": number },
    "snack": { "caloriesPercent": number, "proteinPercent": number, "carbsPercent": number, "fatsPercent": number },
    "dinner": { "caloriesPercent": number, "proteinPercent": number, "carbsPercent": number, "fatsPercent": number }
  }
}

Rules:
- carbs and fats in grams.
- Daily calories (${input.dailyCalories}) and protein (${input.proteinTarget}g) are fixed.
- Remaining calories after protein must be split between carbs (4 kcal/g) and fats (9 kcal/g).
- Respect ${input.dietType} diet preferences.
- mealDistribution percents should sum to ~100% per macro across all meals.`;
}
