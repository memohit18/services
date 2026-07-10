import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MEAL_PLAN_TYPES } from '../../../../../db-schema/postgres/constants/fitforge-values';

/**
 * Phase 5: dietPlanId optional → uses active diet.
 * Legacy clients can still pass dietPlanId + planType.
 */
export class GenerateMealPlanDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Diet plan id (defaults to active diet when omitted)',
  })
  @IsOptional()
  @IsUUID()
  dietPlanId?: string;

  @ApiPropertyOptional({ enum: MEAL_PLAN_TYPES, example: 'weekly' })
  @IsOptional()
  @IsIn(MEAL_PLAN_TYPES)
  planType?: string;

  @ApiPropertyOptional({ example: 7, description: 'Days to generate (1–7 for weekly)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  days?: number;
}
