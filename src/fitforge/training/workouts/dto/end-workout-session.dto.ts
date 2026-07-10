import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class EndWorkoutSessionDto {
  @ApiProperty({ format: 'uuid', description: 'Session id from /workouts/session/start' })
  @IsUUID()
  sessionId!: string;

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
}
