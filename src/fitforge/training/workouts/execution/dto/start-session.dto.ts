import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class StartWorkoutSessionDto {
  @ApiPropertyOptional({
    description: 'WorkoutDay id. If omitted, resolves today from active plan.',
  })
  @IsOptional()
  @IsUUID()
  workoutPlanDayId?: string;
}
