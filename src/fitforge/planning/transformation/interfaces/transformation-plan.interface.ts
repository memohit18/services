import type { TransformationMilestone, TransformationTarget } from '@prisma/client';

export type TransformationWithMilestones = TransformationTarget & {
  milestones: TransformationMilestone[];
};

export type TransformationMetrics = {
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
};
