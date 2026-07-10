import { z } from 'zod';

export const DIET_AI_PROMPT_VERSION = 1;

export const AiDietMealSchema = z.object({
  dayNumber: z.number().int().min(1).max(31),
  mealType: z.enum(['breakfast', 'lunch', 'snack', 'dinner']),
  foodName: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(20).default(1),
});

export const AiDietResponseSchema = z.object({
  goal: z.string().trim().min(1).max(80),
  dailyCalories: z.number().int().min(800).max(6000),
  dailyProtein: z.number().min(20).max(400),
  dailyCarbs: z.number().min(0).max(800),
  dailyFats: z.number().min(0).max(300),
  meals: z.array(AiDietMealSchema).min(1),
});

export type AiDietMeal = z.infer<typeof AiDietMealSchema>;
export type AiDietResponse = z.infer<typeof AiDietResponseSchema>;
