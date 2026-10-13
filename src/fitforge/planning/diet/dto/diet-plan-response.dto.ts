import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DietPlan, MealPlan, MealPlanItem, FoodMaster } from '@prisma/client';
import type {
  DietAiMetadata,
  MealDistribution,
} from '../../../ai/shared/diet-targets.types';
import { toMealAmountView } from '../../../shared/utils/food-amount.util';

/** Legacy targets block — keep field names stable for existing clients. */
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

export class DietMealItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  dayNumber: number;

  @ApiProperty()
  mealType: string;

  @ApiProperty()
  foodId: string;

  @ApiPropertyOptional()
  foodName?: string;

  @ApiProperty({ description: 'Servings relative to food catalog portion' })
  quantity: number;

  @ApiPropertyOptional({
    example: 240,
    description: 'Base catalog portion size',
  })
  servingAmount?: number;

  @ApiPropertyOptional({
    example: 'ml',
    description: 'Unit for servingAmount / amount (g | ml | piece | tbsp | serving)',
  })
  servingUnit?: string;

  @ApiPropertyOptional({ example: '1 cup (240 ml)' })
  servingSize?: string | null;

  @ApiPropertyOptional({
    example: 240,
    description: 'Total amount = quantity × servingAmount',
  })
  amount?: number;

  @ApiPropertyOptional({
    example: '240 ml',
    description: 'Display label for portion (e.g. 240 ml Milk, 150 g Poha)',
  })
  amountLabel?: string;

  @ApiProperty()
  calories: number;

  @ApiProperty()
  protein: number;

  @ApiProperty()
  carbs: number;

  @ApiProperty()
  fats: number;
}

export class DietMealPlanResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  version: number;

  @ApiProperty()
  planType: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: [DietMealItemResponseDto] })
  items: DietMealItemResponseDto[];
}

/**
 * Stable diet plan response used by existing GET/POST diet integrations.
 * Do not rename/remove: id, transformationId, version, status, goal,
 * generatedBy, targets, mealDistribution, aiMetadata, startDate, endDate, createdAt.
 */
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

/** Phase 4 generate/regenerate only — extends legacy shape with audit + meals. */
export class GeneratedDietPlanResponseDto extends DietPlanResponseDto {
  @ApiPropertyOptional({
    description: 'Raw AI JSON stored for audit (Phase 4)',
  })
  responseJson?: unknown;

  @ApiPropertyOptional({ type: DietMealPlanResponseDto })
  mealPlan?: DietMealPlanResponseDto | null;
}

type MealPlanWithItems = MealPlan & {
  items: Array<MealPlanItem & { food?: FoodMaster | null }>;
};

type DietPlanWithMeals = DietPlan & {
  mealPlans?: MealPlanWithItems[];
};

/** Legacy mapper — exact shape for already-integrated clients. */
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

/** Phase 4 generate/regenerate response (additive fields only). */
export function toGeneratedDietResponse(result: {
  dietPlan: DietPlan;
  mealPlan: MealPlanWithItems;
}): GeneratedDietPlanResponseDto {
  const base = toDietPlanResponse(result.dietPlan);
  return {
    ...base,
    responseJson: result.dietPlan.responseJson ?? undefined,
    mealPlan: {
      id: result.mealPlan.id,
      version: result.mealPlan.version,
      planType: result.mealPlan.planType,
      status: result.mealPlan.status,
      items: result.mealPlan.items.map((item) => {
        const amount = item.food
          ? toMealAmountView(item.food, item.quantity)
          : null;
        return {
          id: item.id,
          dayNumber: item.dayNumber,
          mealType: item.mealType,
          foodId: item.foodId,
          foodName: item.food?.name,
          quantity: item.quantity,
          servingAmount: amount?.servingAmount,
          servingUnit: amount?.servingUnit,
          servingSize: amount?.servingSize ?? item.food?.servingSize ?? null,
          amount: amount?.amount,
          amountLabel: amount?.amountLabel,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fats: item.fats,
        };
      }),
    },
  };
}
