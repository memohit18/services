import type { Prisma } from '@prisma/client';
import type { AiDietResponse } from './diet-response.schema';
import { DIET_AI_PROMPT_VERSION } from './diet-response.schema';

export type MappedDietPlanCreate = {
  goal: string;
  caloriesTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatsTarget: number;
  prompt: string;
  responseJson: Prisma.InputJsonValue;
  aiMetadata: Prisma.InputJsonValue;
  generatedBy: 'ai';
};

export type DietAiMetadata = {
  provider: string;
  model: string;
  promptVersion: number;
  attempts: number;
};

/**
 * Maps validated AI JSON → DietPlan persistence fields.
 * Does NOT write meal rows — that happens in the meal normalizer.
 */
export function mapAiDietToDietPlan(params: {
  response: AiDietResponse;
  prompt: string;
  metadata: DietAiMetadata;
}): MappedDietPlanCreate {
  return {
    goal: params.response.goal,
    caloriesTarget: Math.round(params.response.dailyCalories),
    proteinTarget: Math.round(params.response.dailyProtein),
    carbsTarget: Math.round(params.response.dailyCarbs),
    fatsTarget: Math.round(params.response.dailyFats),
    prompt: params.prompt,
    responseJson: params.response as unknown as Prisma.InputJsonValue,
    aiMetadata: {
      provider: params.metadata.provider,
      model: params.metadata.model,
      promptVersion: params.metadata.promptVersion || DIET_AI_PROMPT_VERSION,
      attempts: params.metadata.attempts,
    },
    generatedBy: 'ai',
  };
}
