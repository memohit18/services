import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { FITNESS_GOALS } from '../../../../../db-schema/postgres/constants/fitforge-values';
import { CreateWorkoutDayDto } from './create-workout-day.dto';

export class CreateWorkoutDto {
  @ApiProperty({ enum: FITNESS_GOALS })
  @IsIn(FITNESS_GOALS)
  goal: string;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  daysPerWeek: number;

  @ApiPropertyOptional({ type: [CreateWorkoutDayDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkoutDayDto)
  days?: CreateWorkoutDayDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aiPrompt?: string;
}
