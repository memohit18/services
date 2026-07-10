import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Legacy manual check-in fields are still accepted as overrides.
 * Prefer logging HydrationLog / WorkoutSessionLog / MealLog / ProgressLog
 * and calling POST /checkins/refresh (or POST /checkins with notes only).
 */
export class CreateCheckinDto {
  @ApiPropertyOptional({ example: 78 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weightKg?: number;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  caloriesConsumed?: number;

  @ApiPropertyOptional({ example: 130 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  proteinConsumed?: number;

  @ApiPropertyOptional({ example: 3000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  waterIntakeMl?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  mealsCompleted?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  mealsSkipped?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  workoutCompleted?: boolean;

  @ApiPropertyOptional({ example: 'Felt strong today' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
