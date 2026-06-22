import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  BUDGET_PREFERENCES,
  EXPERIENCE_LEVELS,
  FITNESS_GOALS,
  GENDERS,
  WORKOUT_MODES,
} from '../../../../../db-schema/postgres/constants/fitforge-values';

const ACTIVITY_LEVEL_INPUT = [
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'extra_active',
  'low',
  'moderate',
  'high',
] as const;

const DIET_TYPE_INPUT = [
  'vegetarian',
  'eggetarian',
  'non_vegetarian',
  'vegan',
  'veg',
  'non_veg',
] as const;

export class CreateFitnessProfileDto {
  @ApiProperty({ example: 28 })
  @Type(() => Number)
  @IsInt()
  @Min(13)
  @Max(100)
  age: number;

  @ApiProperty({ enum: GENDERS })
  @IsIn(GENDERS)
  gender: string;

  @ApiProperty({ example: 175 })
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(250)
  heightCm: number;

  @ApiProperty({ example: 78 })
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(300)
  weightKg: number;

  @ApiProperty({ example: 'moderate', enum: ACTIVITY_LEVEL_INPUT })
  @IsIn(ACTIVITY_LEVEL_INPUT)
  activityLevel: string;

  @ApiProperty({ example: 'non_veg', enum: DIET_TYPE_INPUT })
  @IsIn(DIET_TYPE_INPUT)
  dietType: string;

  @ApiProperty({ example: 'muscle_gain', enum: FITNESS_GOALS })
  @IsIn(FITNESS_GOALS)
  fitnessGoal: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  physiqueGoalId: string;

  @ApiPropertyOptional({ example: 85 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetWeightKg?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(3)
  @Max(50)
  targetBodyFat?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  workoutDaysPerWeek?: number;

  @ApiPropertyOptional({ enum: EXPERIENCE_LEVELS })
  @IsOptional()
  @IsIn(EXPERIENCE_LEVELS)
  experienceLevel?: string;

  @ApiPropertyOptional({ example: 'moderate', enum: BUDGET_PREFERENCES })
  @IsOptional()
  @IsIn(BUDGET_PREFERENCES)
  budgetPreference?: string;

  @ApiPropertyOptional({ example: 'gym', enum: WORKOUT_MODES })
  @IsOptional()
  @IsIn(WORKOUT_MODES)
  workoutMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  allergies?: string;
}
