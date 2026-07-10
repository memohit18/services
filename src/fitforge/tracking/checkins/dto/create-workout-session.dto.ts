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
import { WORKOUT_SESSION_STATUSES } from '../../../../../db-schema/postgres/constants/fitforge-values';

export class CreateWorkoutSessionDto {
  @ApiPropertyOptional({ description: 'WorkoutDay id for the planned session' })
  @IsOptional()
  @IsUUID()
  workoutPlanDayId?: string;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 320 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  caloriesBurned?: number;

  @ApiProperty({ enum: WORKOUT_SESSION_STATUSES, example: 'completed' })
  @IsIn([...WORKOUT_SESSION_STATUSES])
  status!: string;

  @ApiPropertyOptional({ description: 'ISO timestamp when session finished' })
  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
