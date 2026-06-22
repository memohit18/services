import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FitnessProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  age: number;

  @ApiProperty()
  gender: string;

  @ApiProperty()
  heightCm: number;

  @ApiProperty()
  weightKg: number;

  @ApiProperty()
  activityLevel: string;

  @ApiProperty()
  dietType: string;

  @ApiProperty()
  fitnessGoal: string;

  @ApiProperty()
  physiqueGoalId: string;

  @ApiPropertyOptional()
  targetWeightKg?: number | null;

  @ApiPropertyOptional()
  targetBodyFat?: number | null;

  @ApiPropertyOptional()
  workoutDaysPerWeek?: number | null;

  @ApiPropertyOptional()
  experienceLevel?: string | null;

  @ApiPropertyOptional()
  allergies?: string | null;

  @ApiProperty()
  budgetPreference: string;

  @ApiPropertyOptional()
  workoutMode?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class FitnessMetricsResponseDto {
  @ApiProperty({ example: 24.5 })
  bmi: number;

  @ApiProperty({ example: 1780 })
  bmr: number;

  @ApiProperty({ example: 2600 })
  tdee: number;

  @ApiProperty({ example: 140 })
  proteinTarget: number;

  @ApiPropertyOptional({ example: 2500 })
  dailyCalorieTarget?: number;
}
