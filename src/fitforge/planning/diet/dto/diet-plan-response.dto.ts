import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DietPlan } from '@prisma/client';
import type {
  DietAiMetadata,
  MealDistribution,
} from '../../../ai/shared/diet-targets.types';

export class DietTargetsResponseDto {
  @ApiPropertyOptional({ example: 2647 })
  calories: number | null;

  @ApiPropertyOptional({ example: 118 })
  protein: number | null;

  @ApiPropertyOptional({ example: 368 })
  carbs: number | null;

  @ApiPropertyOptional({ example: 78 })
  fats: number | null;
}

export class DietPlanResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Transformation plan used for calorie/protein targets',
  })
  transformationId: string | null;

  @ApiProperty({ example: 2 })
  version: number;

  @ApiProperty({ example: 'draft' })
  status: string;

  @ApiPropertyOptional({ example: 'muscle_gain' })
  goal: string | null;

  @ApiProperty({ example: 'ai' })
  generatedBy: string;

  @ApiProperty({ type: DietTargetsResponseDto })
  targets: DietTargetsResponseDto;

  @ApiPropertyOptional()
  mealDistribution: MealDistribution | null;

  @ApiPropertyOptional()
  aiMetadata: DietAiMetadata | null;

  @ApiPropertyOptional()
  startDate: Date | null;

  @ApiPropertyOptional()
  endDate: Date | null;

  @ApiProperty()
  createdAt: Date;
}

export function toDietPlanResponse(plan: DietPlan): DietPlanResponseDto {
  return {
    id: plan.id,
    transformationId: plan.transformationId,
    version: plan.version,
    status: plan.status,
    goal: plan.goal,
    generatedBy: plan.generatedBy,
    targets: {
      calories: plan.caloriesTarget,
      protein: plan.proteinTarget,
      carbs: plan.carbsTarget,
      fats: plan.fatsTarget,
    },
    mealDistribution: (plan.mealDistribution as MealDistribution | null) ?? null,
    aiMetadata: (plan.aiMetadata as DietAiMetadata | null) ?? null,
    startDate: plan.startDate,
    endDate: plan.endDate,
    createdAt: plan.createdAt,
  };
}
