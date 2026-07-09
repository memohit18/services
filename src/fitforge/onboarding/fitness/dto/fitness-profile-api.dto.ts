import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  FITNESS_API_ACTIVITY_LEVELS,
  FITNESS_API_DIET_TYPES,
  FITNESS_API_FITNESS_GOALS,
  FITNESS_API_GENDERS,
  FITNESS_API_WORKOUT_EXPERIENCE,
} from '../constants/fitness-api.enums';

export class CreateFitnessProfileApiDto {
  @ApiProperty({ example: 28 })
  @Type(() => Number)
  @IsInt()
  @Min(13)
  @Max(100)
  age: number;

  @ApiProperty({ enum: FITNESS_API_GENDERS })
  @IsIn(FITNESS_API_GENDERS)
  gender: string;

  @ApiProperty({ example: 180 })
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(250)
  heightCm: number;

  @ApiProperty({ example: 75 })
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(300)
  weightKg: number;

  @ApiProperty({ enum: FITNESS_API_ACTIVITY_LEVELS })
  @IsIn(FITNESS_API_ACTIVITY_LEVELS)
  activityLevel: string;

  @ApiProperty({ enum: FITNESS_API_FITNESS_GOALS })
  @IsIn(FITNESS_API_FITNESS_GOALS)
  fitnessGoal: string;

  @ApiProperty({ example: 'lean', description: 'Slug from GET /fitness/goals' })
  @IsString()
  physiqueGoalId: string;

  @ApiProperty({ enum: FITNESS_API_DIET_TYPES })
  @IsIn(FITNESS_API_DIET_TYPES)
  dietType: string;

  @ApiProperty({ enum: FITNESS_API_WORKOUT_EXPERIENCE })
  @IsIn(FITNESS_API_WORKOUT_EXPERIENCE)
  workoutExperience: string;

  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  workoutDaysPerWeek: number;

  @ApiPropertyOptional({ example: 78 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(300)
  targetWeightKg?: number | null;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(3)
  @Max(60)
  targetBodyFatPercent?: number | null;

  @ApiPropertyOptional({ example: 'Peanuts, Shellfish' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  allergies?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;
}

export class UpdateFitnessProfileApiDto extends PartialType(
  CreateFitnessProfileApiDto,
) {}
