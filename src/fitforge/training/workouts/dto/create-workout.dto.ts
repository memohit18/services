import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { FITNESS_GOALS } from '../../../../../db-schema/postgres/constants/fitforge-values';

export class CreateWorkoutDto {
  @ApiProperty({ enum: FITNESS_GOALS })
  @IsIn(FITNESS_GOALS)
  goal: string;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  daysPerWeek: number;

  @ApiProperty({ example: '{}' })
  @IsString()
  planJson: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aiPrompt?: string;
}
