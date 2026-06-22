import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { MEAL_PLAN_TYPES } from '../../../../../db-schema/postgres/constants/fitforge-values';

export class CreateMealPlanDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  dietPlanId: string;

  @ApiProperty({ enum: MEAL_PLAN_TYPES, example: 'weekly' })
  @IsIn(MEAL_PLAN_TYPES)
  planType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
