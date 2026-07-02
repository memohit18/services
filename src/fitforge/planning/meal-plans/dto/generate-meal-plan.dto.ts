import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MEAL_PLAN_TYPES } from '../../../../../db-schema/postgres/constants/fitforge-values';

export class GenerateMealPlanDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  dietPlanId: string;

  @ApiProperty({ enum: MEAL_PLAN_TYPES, example: 'weekly' })
  @IsIn(MEAL_PLAN_TYPES)
  planType: string;

  @ApiPropertyOptional({ example: 7, description: 'Days to generate (1–7 for weekly)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  days?: number;
}
