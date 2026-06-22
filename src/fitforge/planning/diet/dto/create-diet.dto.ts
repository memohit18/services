import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { FITNESS_GOALS } from '../../../../../db-schema/postgres/constants/fitforge-values';

export class CreateDietDto {
  @ApiProperty({ example: 'muscle_gain', enum: FITNESS_GOALS })
  @IsIn(FITNESS_GOALS)
  goal: string;

  @ApiProperty({ example: 2800 })
  @Type(() => Number)
  @IsInt()
  caloriesTarget: number;

  @ApiProperty({ example: 140 })
  @Type(() => Number)
  @IsInt()
  proteinTarget: number;

  @ApiProperty({ example: '{}' })
  @IsString()
  planJson: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aiPrompt?: string;
}
