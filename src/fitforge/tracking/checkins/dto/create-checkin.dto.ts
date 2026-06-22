import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class CreateCheckinDto {
  @ApiPropertyOptional({ example: 78 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  weightKg?: number;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  caloriesConsumed?: number;

  @ApiPropertyOptional({ example: 130 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  proteinConsumed?: number;

  @ApiPropertyOptional({ example: 3000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  waterIntakeMl?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  mealsCompleted?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  mealsSkipped?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  workoutCompleted?: boolean;
}
