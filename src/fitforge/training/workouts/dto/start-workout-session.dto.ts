import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class StartWorkoutSessionDto {
  @ApiPropertyOptional({
    description: 'Optional WorkoutDay id for the planned session',
  })
  @IsOptional()
  @IsUUID()
  workoutPlanDayId?: string;
}
