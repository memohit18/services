import type { TransformationTarget } from '@prisma/client';
import type { TransformationWithMilestones } from '../interfaces/transformation-plan.interface';

export type TransformationApiResponse = {
  id: string;
  bmi: number;
  bmr: number;
  tdee: number;
  calories: number;
  protein: number;
  estimatedWeeks: number;
  currentWeightKg: number;
  targetWeightKg: number;
  currentBodyFat: number | null;
  targetBodyFat: number | null;
  targetPhysique: string | null;
  status: string;
  milestones?: TransformationWithMilestones['milestones'];
  createdAt: string;
  updatedAt: string;
};

function toIsoString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

export function toTransformationApi(
  plan: TransformationTarget | TransformationWithMilestones,
  includeMilestones = false,
): TransformationApiResponse {
  const response: TransformationApiResponse = {
    id: plan.id,
    bmi: plan.bmi ?? 0,
    bmr: plan.bmr ?? 0,
    tdee: plan.tdee ?? 0,
    calories: plan.dailyCalorieTarget ?? 0,
    protein: plan.proteinTarget ?? 0,
    estimatedWeeks: plan.estimatedWeeks ?? 0,
    currentWeightKg: plan.currentWeightKg,
    targetWeightKg: plan.targetWeightKg,
    currentBodyFat: plan.currentBodyFat,
    targetBodyFat: plan.targetBodyFat,
    targetPhysique: plan.targetPhysique,
    status: plan.status.toUpperCase(),
    createdAt: toIsoString(plan.createdAt),
    updatedAt: toIsoString(plan.updatedAt),
  };

  if (includeMilestones && 'milestones' in plan) {
    response.milestones = plan.milestones;
  }

  return response;
}
