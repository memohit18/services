import type { LlmProvider } from '../../../common/ai/llm.types';

export const DIET_TARGETS_PROMPT_VERSION = 2;

export type MealMacroSplit = {
  caloriesPercent: number;
  proteinPercent: number;
  carbsPercent: number;
  fatsPercent: number;
};

export type MealDistribution = {
  breakfast: MealMacroSplit;
  lunch: MealMacroSplit;
  snack: MealMacroSplit;
  dinner: MealMacroSplit;
};

export type DietAiMetadata = {
  provider: LlmProvider;
  model: string;
  promptVersion: number;
};

export type AiRemainingMacros = {
  carbs: number;
  fats: number;
  mealDistribution: MealDistribution;
};
