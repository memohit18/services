import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { MEAL_LOG_STATUSES } from '../../../../../db-schema/postgres/constants/fitforge-values';

export class CreateMealLogDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  mealPlanItemId: string;

  @ApiProperty({ enum: MEAL_LOG_STATUSES })
  @IsIn(MEAL_LOG_STATUSES)
  status: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  replacementFoodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  originalFoodId?: string;
}
