export type DietPromptFood = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type DietPromptContext = {
  fitnessGoal: string;
  dailyCalories: number;
  dailyProtein: number;
  dietType: string;
  activityLevel: string;
  workoutDaysPerWeek: number | null;
  estimatedWeeks: number | null;
  favoriteFoods: string[];
  restrictedFoods: string[];
  availableFoods: string[];
  budget: string;
  cuisine: string;
  mealsPerDay: number;
  cookingTimeMinutes: number | null;
  mealTiming: string | null;
  catalogFoods: DietPromptFood[];
  days: number;
};

export function buildDietPrompt(ctx: DietPromptContext): string {
  const catalog = ctx.catalogFoods
    .slice(0, 120)
    .map(
      (f) =>
        `- ${f.name} (${f.calories} kcal, P${f.protein}/C${f.carbs}/F${f.fats})`,
    )
    .join('\n');

  return `You are FitForge nutrition AI. Return JSON only. No markdown.

User context:
- Goal: ${ctx.fitnessGoal}
- Engine daily calories (target): ${ctx.dailyCalories}
- Engine daily protein (target g): ${ctx.dailyProtein}
- Diet type: ${ctx.dietType}
- Activity: ${ctx.activityLevel}
- Workout days/week: ${ctx.workoutDaysPerWeek ?? 'n/a'}
- Transformation timeline (weeks): ${ctx.estimatedWeeks ?? 'n/a'}
- Budget: ${ctx.budget}
- Cuisine: ${ctx.cuisine}
- Meals per day: ${ctx.mealsPerDay}
- Cooking time (minutes): ${ctx.cookingTimeMinutes ?? 'flexible'}
- Meal timing: ${ctx.mealTiming ?? 'flexible'}
- Favorite foods: ${ctx.favoriteFoods.join(', ') || 'none'}
- Restricted foods (NEVER use): ${ctx.restrictedFoods.join(', ') || 'none'}
- Available foods (prefer): ${ctx.availableFoods.join(', ') || 'any from catalog'}

Allowed food catalog (use ONLY these exact foodName values):
${catalog || '- (empty catalog)'}

Generate a ${ctx.days}-day Indian diet plan.

Return exactly this JSON shape:
{
  "goal": "Fat Loss",
  "dailyCalories": ${ctx.dailyCalories},
  "dailyProtein": ${ctx.dailyProtein},
  "dailyCarbs": number,
  "dailyFats": number,
  "meals": [
    {
      "dayNumber": 1,
      "mealType": "breakfast",
      "foodName": "Poha",
      "quantity": 1
    }
  ]
}

Rules:
- dailyCalories must be within 10% of ${ctx.dailyCalories}.
- dailyProtein must be within 10% of ${ctx.dailyProtein}.
- Split remaining calories between carbs (4 kcal/g) and fats (9 kcal/g).
- meals must cover days 1..${ctx.days}.
- Each day must include mealType values appropriate for ${ctx.mealsPerDay} meals/day from: breakfast, lunch, snack, dinner.
- Prefer favorites and available foods.
- Never include restricted foods.
- foodName MUST match the catalog exactly (case-insensitive match is ok).
- quantity is servings relative to catalog serving macros.`;
}
