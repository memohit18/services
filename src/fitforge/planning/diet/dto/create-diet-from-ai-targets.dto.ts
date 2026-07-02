import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { FITNESS_GOALS } from '../../../../../db-schema/postgres/constants/fitforge-values';

/** Shape returned by the AI layer — targets only, no meals. */
export class CreateDietFromAiTargetsDto {
  @ApiProperty({ example: 2800 })
  @Type(() => Number)
  @IsInt()
  @Min(500)
  dailyCalories: number;

  @ApiProperty({ example: 150 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  protein: number;

  @ApiProperty({ example: 320 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  carbs: number;

  @ApiProperty({ example: 80 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fats: number;

  @ApiPropertyOptional({ example: 'muscle_gain', enum: FITNESS_GOALS })
  @IsOptional()
  @IsIn(FITNESS_GOALS)
  goal?: string;
}
