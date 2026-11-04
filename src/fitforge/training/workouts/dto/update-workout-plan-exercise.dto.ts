import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateWorkoutPlanExerciseDto {
  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  sets?: number;

  @ApiPropertyOptional({ example: '8-12' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  reps?: string;

  @ApiPropertyOptional({ example: 90, minimum: 0, maximum: 600 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600)
  restSeconds?: number;

  @ApiPropertyOptional({ example: 'Pause at the bottom' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
